import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer';
import { User } from '../../users/entities/user.entity';
import { Asset } from '../../assets/entities/asset.entity';

@Entity('income')
@Index(['user', 'date'])
export class Income {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  source: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Index()
  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  @Column({ type: 'text', nullable: true })
  description: string;

  @Index()
  @ManyToOne(() => User, (user) => user.incomes, { onDelete: 'CASCADE' })
  user: User;

  @Index()
  @ManyToOne(() => Asset, { nullable: true, onDelete: 'CASCADE' })
  asset: Asset;

  @CreateDateColumn()
  createdAt: Date;
}
