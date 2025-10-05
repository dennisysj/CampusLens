import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rawfrontend', { schema: 'public' })
export class RawFrontend {
  @PrimaryGeneratedColumn({ type: 'integer', name: 'objectid' })
  objectid!: number;

  @Column({ type: 'double precision', name: 'objectlongitude' })
  objectLongitude!: number;

  @Column({ type: 'double precision', name: 'objectlatitude' })
  objectLatitude!: number;

  @Column({ type: 'double precision', name: 'userlongitude' })
  userLongitude!: number;

  @Column({ type: 'double precision', name: 'userlatitude' })
  userLatitude!: number;

  @Column({ type: 'double precision', name: 'coordinates', array: true, nullable: true })
  coordinates?: number[];


}
