import express from "express";
import userRouter from "./modules/user/user.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
export function createApp(){
    const app = express();

    app.use(express.json());

    app.get("/",(req,res)=>{
        res.json("welcome to the fincore api")
    })
    app.use("/api/v1/user",userRouter);
    app.use(errorMiddleware);
    return app;
}
//Express setup + routes attach
/* Request
  ↓
Routes
  ↓
Error middleware*/