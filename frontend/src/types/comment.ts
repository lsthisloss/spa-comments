export interface Comment {
    id: string;
    userName: string;
    email: string;
    homePage?: URL;
    text: string;
    createdAt: Date;
    parentId?: string | null;
  }