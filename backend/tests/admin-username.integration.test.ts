import mongoose, { Types } from "mongoose";
import express from "express";
import request from "supertest";
import { afterAll,beforeAll,beforeEach,describe,expect,it,vi } from "vitest";
const ids=vi.hoisted(()=>({admin:"507f1f77bcf86cd799439011",user:"507f1f77bcf86cd799439012",other:"507f1f77bcf86cd799439014"}));
vi.mock("../src/services/token.service.js",()=>({verifyAccessToken:(token:string)=>({sub:token==="admin"?ids.admin:ids.user,sid:"507f1f77bcf86cd799439013"}),isAccessSessionActive:async()=>true}));
import {User} from "../src/models/User.js";
import routes from "../src/routes/admin-users.routes.js";
import {requireAuth} from "../src/middleware/auth.js";
import {requireAdmin} from "../src/middleware/admin.js";
const uri=process.env.QA_MONGODB_URI;
describe.skipIf(!uri)("admin username editing, isolated MongoDB",()=>{
 const app=express();app.use(express.json());app.use("/users",requireAuth,requireAdmin,routes);app.use((e:any,_q:express.Request,s:express.Response,_n:express.NextFunction)=>s.status(e.statusCode??500).json({error:{code:e.code,message:e.message}}));
 const preferences={language:"ru",theme:"auto",savingsGoalCents:1000,notificationsEnabled:false,dailyReminderEnabled:false,timezone:"UTC"};
 beforeAll(async()=>{if(!uri?.startsWith("mongodb://127.0.0.1:27938/"))throw Error("Isolated QA only");await mongoose.connect(uri,{dbName:`logic_coin_qa_username_${Date.now()}`});await User.init();});
 beforeEach(async()=>{await User.deleteMany({});await mongoose.connection.db!.collection("adminuseraudits").deleteMany({});await User.create([{_id:ids.admin,name:"Admin",email:"admin@example.invalid",referralCode:"ADMINQA",role:"admin"},{_id:ids.user,name:"Test",email:"test@example.invalid",referralCode:"USERQA",username:"old_user",preferences,wallet:{availableUnits:44.35},coins:{balance:123}},{_id:ids.other,name:"Other",email:"other@example.invalid",referralCode:"OTHERQA",username:"taken_user"}]);});
 afterAll(async()=>{await mongoose.connection.dropDatabase();await mongoose.disconnect();});
 async function body(username?:string|null){const old=(await User.findById(ids.user).lean())!;return {expectedUpdatedAt:old.updatedAt.toISOString(),reason:"QA nickname update",profile:{name:old.name,email:old.email,avatarUrl:"",preferences,wallet:{availableUnits:old.wallet.availableUnits},coins:{balance:old.coins.balance},...(username!==undefined?{username}:{})}};}
 const patch=(input:object)=>request(app).patch(`/users/${ids.user}`).set("Authorization","Bearer admin").send(input);
 it("lists and searches the actual username, including @ prefix",async()=>{const r=await request(app).get("/users?q=@old_user").set("Authorization","Bearer admin").expect(200);expect(r.body.data.users).toHaveLength(1);expect(r.body.data.users[0].username).toBe("old_user");});
 it("normalizes and audits edits while preserving name and fractional money",async()=>{await patch(await body("@New_User")).expect(200);const u=(await User.findById(ids.user))!;expect(u.username).toBe("new_user");expect(u.name).toBe("Test");expect(u.wallet.availableUnits).toBe(44.35);expect(u.coins.balance).toBe(123);const a=await mongoose.connection.db!.collection("adminuseraudits").findOne({});expect(a!.before.username).toBe("old_user");expect(a!.after.username).toBe("new_user");});
 it("rejects duplicates and rolls the whole edit back",async()=>{const b=await body("TAKEN_USER");b.profile.name="Should rollback";const r=await patch(b).expect(409);expect(r.body.error.code).toBe("username_taken");expect((await User.findById(ids.user))!.username).toBe("old_user");expect((await User.findById(ids.user))!.name).toBe("Test");expect(await mongoose.connection.db!.collection("adminuseraudits").countDocuments()).toBe(0);});
 it.each(["admin","a","1name","bad name","кириллица"])("rejects an invalid or reserved nickname %s",async name=>{await patch(await body(name)).expect(400);expect((await User.findById(ids.user))!.username).toBe("old_user");});
 it("clears with a sparse index-compatible unset and preserves omitted values",async()=>{await patch(await body()).expect(200);expect((await User.findById(ids.user))!.username).toBe("old_user");await patch(await body("")).expect(200);expect((await User.findById(ids.user))!.toObject()).not.toHaveProperty("username");});
 it("rejects stale revisions, protected fields and unauthorized callers",async()=>{const b=await body("new_name");await User.updateOne({_id:ids.user},{$set:{name:"Changed"}});await patch(b).expect(409);await request(app).patch(`/users/${ids.user}`).send(b).expect(401);await request(app).patch(`/users/${ids.user}`).set("Authorization","Bearer user").send(b).expect(403);await patch({...await body("new_name"),profile:{...(await body()).profile,role:"admin"}}).expect(400);});
});
