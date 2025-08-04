import { Adapter, Context, Logger, Universal } from 'koishi'
import axios from 'axios';
import dayjs from 'dayjs';
import { createInterface } from 'readline'
import { OttohubBot } from './bot'
import { log } from 'console'
import { OttohubMessage } from './message';
import { OttohubUser } from './user';

export class OttohubAdapter<C extends Context> extends Adapter<C,OttohubBot<C>> {
  // 这个适配器仍然是可重用的
  static reusable = true
    status: String;
  static STATUS_NEW:String = "new";
  static STATUS_LOGGINGIN:String = "loggingin";
  static STATUS_ERR:String = "err";
  static STATUS_RUNNING:String = "running";
  private timer: NodeJS.Timeout | null = null; 
  private processedUnreadMessage:Number[] = [];
  constructor(ctx: C, config: OttohubBot.Config) {
    super(ctx);
    this.status = OttohubAdapter.STATUS_NEW;
  }
  async connect(bot: OttohubBot<C>) {
    bot.ctx.logger.info("Starting...")
    bot.status=Universal.Status.CONNECT;
    await this.doLogin(bot);
    if(this.status==OttohubAdapter.STATUS_ERR){
      bot.offline();
      return;
    }
    this.timer = setInterval(() => this.update(bot), bot.config.timeout);
  }
  async update(bot:OttohubBot<C>){
    if(this.status==OttohubAdapter.STATUS_LOGGINGIN){
        await this.doLogin(bot);
    }
    const ml = await this.getMessageList(bot);
    if(ml==null||ml.length===0) return;
    for (const v of ml) {
        if(this.processedUnreadMessage.includes(v.id)) continue;
        this.processedUnreadMessage.push(v.id);
        this.readMessage(bot, v);
        bot.ctx.logger.info(`Bot ${bot.user.name} received ${v.content}`);
        //发送消息
        const session = bot.session()
        session.type = 'message'
        session.userId = bot.userId
        session.channelId = 'private:'+v.from.uid;
        session.isDirect = true
        session.content = v.content.toString();
        session.event.user.id=v.from.uid.toString();
        session.event.user.name=v.from.username.toString();
        session.messageId=v.id.toString();
        session.guildId=v.from.uid.toString();
        bot.dispatch(session)
    }
  }
  async readMessage(bot:OttohubBot<C>,msg:OttohubMessage){
    await axios.get(bot.config.endpoint+"/?module=im&action=read_message&token="+bot.internal.token+"&msg_id="+msg.id)
    removeValueFromArrayInPlace(this.processedUnreadMessage,msg.id);
    bot.logger.info("read msg "+msg.id);
    
  }
  async getMessageList(bot:OttohubBot<C>):Promise<OttohubMessage[]>{
    let rawML:any[] = [];
    for(let i:number=0;true;i++){
        const urml = await axios.get(bot.config.endpoint+"/?module=im&action=unread_message_list&token="+bot.internal.token+"&num=12&offset="+(i*12));
        if(urml.data.toString().includes("error_token")){
          this.status=OttohubAdapter.STATUS_LOGGINGIN;
          bot.offline();
          bot.status=Universal.Status.RECONNECT;
          return null;
        }
        if(urml.data.status!='success'){
            bot.logger.warn("failed fetch messages: "+urml.data.message);
            return null;
        }
        rawML.push(...urml.data.unread_message_list);
        if(urml.data.unread_message_list.length === 0){
            break;
        }
    }
    rawML.forEach(function(v,i,a){   
        let msg = new OttohubMessage();
        msg.content=v.content;
        msg.time = dayjs(v.time,"YYYY-MM-DD HH:MM:SS").toDate();
        msg.from = new OttohubUser();
        msg.from.uid = v.sender;
        msg.from.username = v.sender_name;
        msg.id = v.msg_id;
        a[i] = msg;
    });
    return rawML;
  }
  async disconnect(bot: OttohubBot<C>) {
    bot.ctx.logger.info("Stopping...");
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.ctx.logger.info('Interval Stoped');
    }
  }
  async doLogin(bot: OttohubBot<C, OttohubBot.Config>) {
    this.status = OttohubAdapter.STATUS_LOGGINGIN;
    let cfg = (OttohubBot.Config)(bot.config);
    const loginResult = await axios.get(cfg.endpoint+`/?module=auth&action=login&uid_email=${cfg.user}&pw=${cfg.password}`)
    if(loginResult.status!=200||loginResult.data.status!="success"){
        bot.ctx.logger.error(`Login failed: ${loginResult.data.message}`);
        bot.status=Universal.Status.DISCONNECT;
        bot.offline();
        bot.user.name="ERROR: "+loginResult.data.message;
        bot.user.avatar=cfg.endpoint+"/public/img/avatar_revoked.jpg";
        this.status = OttohubAdapter.STATUS_ERR;
        return;
    }
    bot.internal.token=loginResult.data.token;
    bot.internal.uid=loginResult.data.uid;
    const profileResult = await axios.get(cfg.endpoint+`/?module=profile&action=user_profile&token=${bot.internal.token}`)
    bot.user.avatar=loginResult.data.avatar_url;
    bot.user.name=profileResult.data.profile.username;
    bot.status=Universal.Status.ONLINE;
    bot.online();
    bot.ctx.logger.info("Login successful!: "+bot.user.id);
    this.status=OttohubAdapter.STATUS_RUNNING;
  }
}
function removeValueFromArrayInPlace<T>(arr: T[], value: T): void {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] === value) {
      arr.splice(i, 1);
    }
  }
}