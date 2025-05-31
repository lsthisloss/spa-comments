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
import { Post } from '../../posts/entities/post.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.comments, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Post, (post) => post.comments, { nullable: false })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column()
  postId: string;

  @ManyToOne(() => Comment, (comment) => comment.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentId' })
  parent?: Comment;

  @OneToMany(() => Comment, (comment) => comment.parent)
  children: Comment[];

  @Column({ nullable: true })
  parentId?: string | null;

  @Column({ default: 0 })
  likes: number;

  @Column({ type: 'varchar', nullable: true })
  fileUrl?: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl?: string | null;

  @Column('simple-array', { default: '' })
  likedUserIds: string[];

  @Column({ default: 0 })
  repliesCount: number;

  @Column({ type: 'varchar', nullable: true })
  numericId?: string;

  @Column({ unique: true })
  slug: string;
}
