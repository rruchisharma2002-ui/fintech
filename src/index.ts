import { createApp } from "./app.ts";

const app = createApp();
const port = 3000;
app.listen(port,()=>{
    console.log(`Server is running on port ${port}`);
});
//get application
//start server