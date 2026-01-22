export class InitializeSystemResponseDto {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}
