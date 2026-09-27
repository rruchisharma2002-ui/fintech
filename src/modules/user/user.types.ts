export type User = {
    id: string;
    name: string;
    email: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
}
export type PublicUser ={
    id:string;
    name:string;
     email:string;

};
export type LoginResponse = {
    accessToken:string;
    user:PublicUser;
    refreshToken:string;
}
//Password hash / compare, business rules
//User object ka shape