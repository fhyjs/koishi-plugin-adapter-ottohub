import { Context, Element, MessageEncoder } from "koishi"
import { OttohubBot } from "./bot"
import axios from "axios"
import { log } from "console"
import FormData from 'form-data';

export class OMessageEncoder<C extends Context = Context> extends MessageEncoder<
  C,
  OttohubBot<C>
> {
  buffer = ""

  async flush() {
    if (!this.buffer.trim()) return
    if (this.session.channelId.startsWith("private:")) {
      const userId = this.session.channelId.slice(8)
      await this.sendPrivateMessage(userId, this.buffer)
    }
    this.buffer = ""
  }
    async sendPrivateMessage(userId: string, buffer: string) {
        buffer.replaceAll("\n","<br/>")
        const sendReslut = await axios.get(this.bot.config.endpoint+"/?module=im&action=send_message&token="+this.bot.internal.token+"&receiver="+userId+"&message="+buffer);
        if(sendReslut.data.status=='error'){
            buffer="<font color='red'>为你发送消息失败:"+sendReslut.data.message+"</font>"
            axios.get(this.bot.config.endpoint+"/?module=im&action=send_message&token="+this.bot.internal.token+"&receiver="+userId+"&message="+buffer);
        }
    }

  async visit(element: Element) {
    // since OTTOHUB chat is normally HTML only & 222 words limited, only the most basic processing is done
    const { type, attrs, children } = element
    if (type === "text") {
      this.buffer += attrs.content.replaceAll("\\n","<br/>").replaceAll("\n","<br/>")
    } else if (type === "at") {
      this.buffer += `@${attrs.type || attrs.id}`
    } else if (type === "sharp") {
      this.buffer += `#${attrs.id}`
    } else if (type === "br") {
      this.buffer += "<br/>"
    } else if (type === "p") {
      if (!this.buffer.endsWith("<br/>")) this.buffer += "<br/>"
      await this.render(children)
      if (!this.buffer.endsWith("<br/>")) this.buffer += "<br/>"
    } else if (type === "message") {
      await this.flush()
      await this.render(children)
      await this.flush()
    } else if (type === "img") {
      var img:any = new Object();
      if(element.attrs.src.toString().includes("data:image")){
        img = await this.uploadImage(element.attrs.src, "koishi_ottohub_"+process.hrtime.bigint()+".png");
      }else{
        img.success=true;
        img.data.url = element.attrs.src;
      }
      if(img.success==false){
        this.buffer += "<font color='red'>[这个图片上传失败了]</font>";
      }else{
        this.buffer += `<img src="${img.data.url}"/>`;
      }
    } else {
      log(element)
      await this.render(children)
    }
  }
  async uploadImage(base64Data: string, filename: string) {
    base64Data=base64Data.replace(/^data:image\/\w+;base64,/, '');
    const form = new FormData();
    const buffer = Buffer.from(base64Data, 'base64');
    // 添加图片字段
     // 添加字段：图片内容（作为文件）
    form.append('image', buffer, {
      filename: filename,
      contentType: 'image/png', // 根据实际类型调整
    });

    // 添加其他字段
    form.append('outputFormat', 'auto');
    this.bot.logger.debug("上传图片参数：", {
      base64: base64Data.slice(0, 100), // 避免太长
      headers: form.getHeaders?.(),
      length: form.getLengthSync?.()
    });
    const response = await axios.post('https://img.scdn.io/api/upload.php', form, {
      maxBodyLength: Infinity, // 允许大文件上传
      headers: form.getHeaders(),
    });

    this.bot.logger.info('Image upload:', response.data);
    return response.data;
  }
}