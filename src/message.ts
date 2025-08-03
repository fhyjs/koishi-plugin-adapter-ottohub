import { OttohubUser } from "./user";

export class OttohubMessage{
    from:OttohubUser;
    to:OttohubUser;
    content:String;
    id:Number;
    time:Date;
}