import { RowDataPacket } from 'mysql2';

interface EmailCheckUser extends RowDataPacket {
    id: number;
    email: string;
}

interface SignInUser extends RowDataPacket {
    email: string;
    password: string; // bcrypt 비교를 위해 필요
}

interface SignUpUser extends RowDataPacket {
    email: string;
    password: string;
    petType: string[];
}

export { SignInUser, SignUpUser, EmailCheckUser }