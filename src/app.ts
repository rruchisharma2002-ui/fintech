import express from "express";
import userRouter from "./modules/user/user.routes.js";
export function createApp(){
    const app = express();

    app.use(express.json());

    app.get("/",(req,res)=>{
        res.json("eddie guerrero")
    })
    app.use("/api/v1/user",userRouter);
    return app;
}