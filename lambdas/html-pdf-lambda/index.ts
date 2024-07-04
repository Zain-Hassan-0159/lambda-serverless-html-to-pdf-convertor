import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { generatePdfBuffer } from './generatePdfBuffer';
import { Readable } from 'stream';

// Hardcoded bucket names
const HTML_BUCKET = "htmlpdfserverlessstack-pdfss3bucketddbbf369-kxju0mtbgkka";
const PDF_BUCKET = "htmlpdfserverlessstack-pdfss3bucketddbbf369-kxju0mtbgkka";

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
    if (!event.body) {
        console.error("No request body provided");
        return {
            statusCode: 400,
            body: "Invalid request body"
        };
    }

    try {
        const requestBody = JSON.parse(event.body) as { htmlS3Key: string };

        console.log(`Parsed request body: ${JSON.stringify(requestBody)}`);

        // Retrieve HTML content from S3
        const getObjectParams = {
            Bucket: HTML_BUCKET,
            Key: `in/${requestBody.htmlS3Key}.html`
        };

        console.log(`Getting object from S3 with params: ${JSON.stringify(getObjectParams)}`);

        const command = new GetObjectCommand(getObjectParams);
        const response = await s3Client.send(command);
        const htmlContent = await response.Body.transformToString();

        console.log(`Retrieved HTML content from S3: ${htmlContent}`);

        // Generate PDF buffer from HTML content
        const pdfBuffer = await generatePdfBuffer(htmlContent);

        if (!pdfBuffer) {
            throw new Error('Failed to create PDF buffer from HTML');
        }

        console.log(`Generated PDF buffer: ${pdfBuffer.length} bytes`);

        const pdfS3Key = `out/${requestBody.htmlS3Key}.pdf`;

        console.log(`Uploading PDF to S3 with key: ${pdfS3Key}`);

        // Upload PDF buffer to S3
        const s3Upload = new Upload({
            client: s3Client,
            params: {
                Bucket: PDF_BUCKET,
                Body: pdfBuffer,
                Key: pdfS3Key
            }
        });

        s3Upload.on("httpUploadProgress", (progress) => {
            console.log(progress);
        });
        await s3Upload.done();

        // Generate presigned URL for the uploaded PDF
        const presignedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: PDF_BUCKET, Key: pdfS3Key }),
            { expiresIn: 3600 }
        );

        console.log(`Generated presigned URL: ${presignedUrl}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                pdfUrl: presignedUrl
            })
        };
    } catch (error) {
        console.error("Error converting HTML to PDF", error);
        return {
            statusCode: 500,
            body: "Internal server error"
        };
    }
};
