using Amazon.S3;
using Amazon.S3.Model;

namespace FindMyParty.Parties.API.Infrastructure.Storage;

public class S3ImageService(IAmazonS3 s3Client, IConfiguration configuration) : IS3ImageService
{
    private readonly string _bucketName = configuration["AWS:S3:BucketName"]!;

    public async Task<string> UploadAsync(Stream fileStream, string key, string contentType)
    {
        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            InputStream = fileStream,
            ContentType = contentType,
            CannedACL = S3CannedACL.PublicRead
        };

        await s3Client.PutObjectAsync(request);

        return $"https://{_bucketName}.s3.amazonaws.com/{key}";
    }
}
