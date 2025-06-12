import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.posts, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @Column({ default: 0 })
  likes: number;

  @Column({ nullable: true })
  fileUrl?: string;

  @Column({ nullable: true })
  fileType?: string;

  @Column({ nullable: true })
  fileName?: string;

  @Column('simple-array', { default: '' })
  likedUserIds: string[];

  @Column({ default: 0 })
  repliesCount: number;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ unique: true })
  slug: string;
}
