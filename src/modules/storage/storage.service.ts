import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.region');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>(
      'aws.secretAccessKey',
    );
    const bucketName = this.configService.get<string>('aws.s3Bucket');

    if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        'Missing AWS configuration: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET are required',
      );
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.bucketName = bucketName;
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'images',
  ): Promise<string> {
    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${randomUUID()}.${fileExtension}`;
    const key = `${folder}/${fileName}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: folder === 'images' ? 'public-read' : 'private',
    });

    await this.s3Client.send(command);

    // Return public URL
    const region = this.configService.get<string>('aws.region');
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    // Extract key from URL
    const key = this.extractKeyFromUrl(fileUrl);

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  private validateFile(file: Express.Multer.File): void {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/quicktime', // .mov files
    ];

    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 100MB limit');
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }
  }

  private extractKeyFromUrl(url: string): string {
    // Extract key from S3 URL
    // Example: https://bucket.s3.region.amazonaws.com/folder/file.jpg -> folder/file.jpg
    const urlParts = url.split('.amazonaws.com/');
    if (urlParts.length < 2) {
      throw new BadRequestException('Invalid S3 URL');
    }
    return urlParts[1];
  }
}
