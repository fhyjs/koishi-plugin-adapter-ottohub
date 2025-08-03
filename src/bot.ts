import { Bot, Context, h, Schema, Adapter } from 'koishi'
import { EOL } from 'os'
import { OttohubAdapter } from './adapter'
import { log } from 'console'
import { OttohubLogin } from './login'
import { Message, SendOptions } from '@satorijs/protocol'
import { OMessageEncoder } from './msg_encoder'

export class OttohubBot<C extends Context> extends Bot<C>{
  internal: OttohubLogin;
  static MessageEncoder = OMessageEncoder
  constructor(ctx: C, config: OttohubBot.Config) {
    super(ctx, config,"ottohub")
    this.platform = 'ottohub'
    this.selfId = "ottohub_"+config.user
    ctx.plugin(OttohubAdapter, this)
    this.internal=new OttohubLogin();
  }

}
export interface OttohubBot<C extends Context, T extends OttohubBot.Config = OttohubBot.Config> {
  
}
export namespace OttohubBot {
    export interface Config {
        endpoint: string
        user: string
        password: string
  }
  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      endpoint: Schema.string()
        .role("url")
        .default("https://api.ottohub.cn")
        .description("ottohubAPI的基本地址"),
      user: Schema.string()
        .default("4384")
        .description("邮箱或uid"),
      password: Schema.string()
        .default("password")
        .description("你的登录密码")
    })
  ])
}