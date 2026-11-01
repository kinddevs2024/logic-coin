import { expect, it } from "vitest";
import { Types } from "mongoose";
import { LiveRaffle } from "../src/models/LiveRaffle.js";
const base = {title:"Призы",startsAt:new Date(Date.now()+3600000),youtubeId:"tRsQsTMvPNg",createdBy:new Types.ObjectId(),rounds:[{label:"Наушники",kind:"physical",cashUnits:0,durationSeconds:15}]};
it("preserves all event and physical prize translations when serializing a saved shape",()=>{
 const titles={ru:"Призы",uz:"Sovrinlar",en:"Prizes"};const labels={ru:"Наушники",uz:"Quloqchin",en:"Headphones"};
 const event=new LiveRaffle({...base,titles,rounds:[{...base.rounds[0],labels}]});
 expect(event.validateSync()).toBeUndefined();const value=JSON.parse(JSON.stringify(event));expect(value.titles).toEqual(titles);expect(value.rounds[0].labels).toEqual(labels);
});
it("keeps legacy events valid without localized fields",()=>{
 const event=new LiveRaffle(base);expect(event.validateSync()).toBeUndefined();expect(event.title).toBe("Призы");expect(event.rounds[0].label).toBe("Наушники");
});
