import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  userName: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: 'circle' })
  avatarShape: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Post, (post) => post.user, { cascade: true })
  posts: Post[];

  @OneToMany(() => Comment, (comment) => comment.user, { cascade: true })
  comments: Comment[];
  @ManyToMany(() => User, (user) => user.followers)
  @JoinTable({
    name: `user_following`,
    joinColumn: { name: `userId`, referencedColumnName: `id` },
    inverseJoinColumn: { name: `followingId`, referencedColumnName: `id` },
  })
  following: User[];

  @ManyToMany(() => User, (user) => user.following)
  followers: User[];
}
