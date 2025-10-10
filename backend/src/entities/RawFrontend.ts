import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rawfrontend', { schema: 'public' })
export class RawFrontend {
  @PrimaryGeneratedColumn({ type: 'integer', name: 'objectid' })
  objectid!: number;

  @Column({ type: 'double precision', name: 'objectlongitude' })
  objectLongitude!: number;

  @Column({ type: 'double precision', name: 'objectlatitude' })
  objectLatitude!: number;

  @Column({ type: 'geometry', name: 'object_location', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  objectLocation?: string;

  @Column({ type: 'double precision', name: 'userlongitude' })
  userLongitude!: number;

  @Column({ type: 'double precision', name: 'userlatitude' })
  userLatitude!: number;

  @Column({ type: 'geometry', name: 'user_location', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  userLocation?: string;

  @Column({ type: 'double precision', name: 'coordinates', array: true, nullable: true })
  coordinates?: number[];


}
