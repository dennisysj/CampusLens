import { AppDataSource } from './typeorm';

import { SfuStadiumPixels } from '../entities/SfuStadiumPixels';

// Export repositories for easy access

export const sfuStadiumPixelsRepository = AppDataSource.getRepository(SfuStadiumPixels);

// Export entities


// Export data source
export { AppDataSource };
