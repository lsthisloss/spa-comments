## A TypeScript-based fullstack SPA Comments application with real-time updates, RabbitMQ, and nested replies, follows SOLID principles

## Features
- Uses TypeScript (NestJS backend, React frontend)    
- Websocket as a communication protocol    
- Modular, scalable architecture    
- PostgreSQL + TypeORM for data storage    
- RabbitMQ for async comment queueing      
- WebSocket (Socket.IO) for real-time updates    
- Nested comments, likes, captcha, file/image upload    
- Memoized React components for performance    

## Backend Classes & Modules

`CommentsGateway` — WebSocket gateway for comment events: fetchComments, fetchNestedComments, addComment, likeComment, unlikeComment, generateCaptcha, validateCaptcha, uploadImage.    
`CommentsService` — Business logic, DB operations, RabbitMQ publishing, event emitting.    
`CommentsController` — REST API (getComments, getCommentById, uploadImage, createComment).    
`CommentsConsumer` — RabbitMQ consumer, saves comments from the queue.    
`AppGateway` — Global WebSocket emitter (broadcastEvent, heartbeat).    
`RabbitMQService` — Handles RabbitMQ connection, message sending/receiving.    
`Comment` — TypeORM entity for the comments table.    

## Backend WebSocket Events

`fetchComments` — Get paginated comments list.    
`fetchNestedComments` — Get parent and child comments.    
`addComment` — Add a comment (with file/image support).    
`likeComment` / `unlikeComment` — Like/unlike a comment.    
`generateCaptcha` / `validateCaptcha` — Captcha for spam protection.    
`uploadImage` — Image upload.    

## RabbitMQ

Queue `add_comment_queue` for async comment creation.    
`CommentsService.sendCommentToQueue` — Sends DTO to the queue.    
`CommentsConsumer` — Processes messages, saves to DB, emits WebSocket events.    


## Frontend (React + Vite)

`WebSocketProvider`— Context for Socket.IO client.    
`CommentForm` — Add comment form, file upload, captcha.    
`CommentList` — Comment list (React.memo).    
`CommentItem` — Single comment (memoized).    
`CommentFooter` — Likes, reply, WebSocket event handling.    
`MainPage` — Pagination, auto-update, new comment buffering.    
`NestedCommentsPage` — Thread view, real-time replies.    

## WebSocket клиент (frontend)

- Connection via `createWebSocket`    
- Listening events : `newComment`, `commentLiked`, `commentUnliked`, `heartbeat`    
- Emit : `addComment`, `likeComment`, `unlikeComment`, `fetchComments`, `fetchNestedComments`, `generateCaptcha`, `validateCaptcha`, `uploadImage`    

## Project structure

<details>
<summary>Click to expand the project structure</summary>

```plaintext
spa-comments/
├── backend/                                   # Backend (NestJS)
│   ├── Dockerfile                             # Docker image for backend
│   ├── package.json                           # Backend dependencies and scripts
│   ├── tsconfig.json                          # TypeScript config for backend
│   ├── .gitignore                             # Git ignore file
│   ├── src/
│   │   ├── app.module.ts                      # Main NestJS application module
│   │   ├── app.gateway.ts                     # Global WebSocket gateway (event emitter)
│   │   ├── app.controller.ts                  # Example REST controller (root endpoint)
│   │   ├── comments/
│   │   │   ├── comments.controller.ts         # REST API for comments (CRUD, upload)
│   │   │   ├── comments.gateway.ts            # WebSocket gateway: handles events (fetch, add, like, captcha, upload)
│   │   │   ├── comments.module.ts             # NestJS module for comments
│   │   │   ├── comments.service.ts            # Business logic, DB and RabbitMQ interaction
│   │   │   ├── entities/comment.entity.ts     # TypeORM entity for "Comment" table
│   │   │   ├── dto/create-comment.dto.ts      # DTO for creating a comment
│   │   ├── rabbitmq/
│   │   │   ├── rabbitmq.module.ts             # NestJS module for RabbitMQ
│   │   │   ├── rabbitmq.service.ts            # Service for RabbitMQ queue operations
│   │   │   └── consumers/comments.consumer.ts # Consumer: processes queue messages, saves comments to DB
│   │   ├── uploads/                           # Folder for uploaded files/images
│   └── ...
├── frontend/                                  # Frontend (React + Vite)
│   ├── Dockerfile                             # Docker image for frontend
│   ├── package.json                           # Frontend dependencies and scripts
│   ├── tsconfig.json                          # TypeScript config for frontend
│   ├── index.html                             # Main HTML template
│   ├── index.scss                             # Global styles
│   ├── public/                                # Public assets (icons, favicons)
│   ├── src/
│   │   ├── App.tsx                            # Main React application component
│   │   ├── main.tsx                           # React entry point
│   │   ├── components/
│   │   │   ├── WebSocketProvider.tsx          # WebSocket context provider for the app
│   │   │   ├── Layout.tsx                     # Main layout component
│   │   │   ├── SideBar.tsx                    # Sidebar navigation
│   │   │   ├── comments/
│   │   │   │   ├── CommentForm.tsx            # Comment form (file upload, captcha)
│   │   │   │   ├── CommentList.tsx            # List of comments (memoized)
│   │   │   │   ├── CommentItem.tsx            # Single comment (memoized)
│   │   │   │   ├── CommentFooter.tsx          # Comment footer (likes, actions, date)
│   │   │   │   ├── FormFooter.tsx             # Form footer (buttons, char counter, upload)
│   │   ├── pages/
│   │   │   ├── MainPage.tsx                   # Main page: comment feed, pagination
│   │   │   ├── NestedCommentsPage.tsx         # Threaded/nested comments page
│   │   │   ├── WhoAmIPage.tsx                 # User profile/settings page
│   │   ├── styles/
│   │   │   ├── main.scss                      # Main SCSS file, imports all styles
│   │   │   ├── base/                          # Base variables, resets, mixins
│   │   │   ├── components/                    # Component-specific styles
│   └── ...
├── docker-compose.yml                         # Docker Compose for full stack (frontend, backend, db, rabbitmq)
└── ...
```
</details>

## Database (PostgreSQL, TypeORM)

```ts
@Entity('comments')
export class Comment {
  id: string;
  userName: string;
  email: string;
  homePage?: string;
  text: string;
  createdAt: Date;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  parentId?: string | null;
  likes: number;
}
```


## How to run

<details>
<summary>Click to expand the guide </summary>
  
```plaintext
git clone 
cd spa-comments
bash run.sh
You will see a menu, type 1 and press Enter to start local deployment.
root@ubuntu-4gb-hel1-2:~/spa-comments# bash run.sh
  ----------------------------------------------------------------------  
  -                        Deployment Menu                             -  
  ----------------------------------------------------------------------  
         1 - Run Local
  ----------------------------------------------------------------------  

Input action number >  1
```
  
- Frontend: http://localhost:5174  
- Backend API: http://localhost:3001  
- WebSocket: ws://localhost:3001
</details>

## Demo
<details>
<summary>Click to expand</summary>
  
![image](https://github.com/user-attachments/assets/71ad490a-7514-406a-af11-179028e35882)

  
</details>

---
