import { Context, Element, MessageEncoder } from "koishi"
import { OttohubBot } from "./bot"
import axios from "axios"
import { log } from "console"

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
            buffer="<font color='red'>为你发送消息失败:"+sendReslut.data.message+"</color>"
            axios.get(this.bot.config.endpoint+"/?module=im&action=send_message&token="+this.bot.internal.token+"&receiver="+userId+"&message="+buffer);
        }
    }

  async visit(element: Element) {
    // since Minecraft chat is normally plain text only, only the most basic processing is done
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
    } else {
      await this.render(children)
    }
  }
}