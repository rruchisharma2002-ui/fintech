import {z} from "zod";
 export const registerSchema = z.object({
     name:z
     .string()
     .trim()
     .min(2,{message:"Name must be atleast 2 characters "}),
     
      email:z
      .string()
      .trim()
      .email({message:"Invalid email format"})
      .toLowerCase(),
     
      password:z
      .string()
      .trim()
      .min(8,{message:"Password must be at least 8 characters long"})
 });
 
 export const loginSchema = z.object({
     email:z
     .string()
     .trim()
     .email({message:"Invalid email format"})
     .toLowerCase(),
     
     password:z
     .string()
     .trim()
     .min(8,{message:"Password must be at least 8 characters long"})
 });    