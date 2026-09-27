export class RefreshTokenReuseError extends Error{
    constructor(){
        super('Refresh token reuse detected');
        this.name = 'RefreshTokenReuseError';
    }
}

// export class RefreshTokenExpiredError extends Error{
//     constructor(){
//         super('Refresh token expired');
//         this.name = 'RefreshTokenExpiredError';
//     }
// }

// export class RefreshTokenInvalidError extends Error{
//     constructor(){
//         super('Refresh token invalid');
//         this.name = 'RefreshTokenInvalidError';
//     }
// }