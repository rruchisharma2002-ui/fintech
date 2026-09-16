import { createApp } from "./app.js";

const app = createApp();
const port = 3000;
app.listen(port,async ()=>{
    console.log(`Server is running on port ${port}`);
});