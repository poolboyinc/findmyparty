using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace FindMyParty.Api.Storage;

public interface IImageStorage
{
    /// <summary>False when no storage is configured; uploads are refused but the rest of the API works.</summary>
    bool IsConfigured { get; }

    /// <summary>Stores the image and returns its public URL.</summary>
    Task<string> UploadAsync(Stream content, string key, string contentType, CancellationToken ct = default);
}

/// <summary>
/// Any S3-compatible bucket: Cloudflare R2, AWS S3, Backblaze B2, MinIO.
/// Configure under "Storage": ServiceUrl, AccessKey, SecretKey, Bucket, PublicBaseUrl.
/// </summary>
public class S3ImageStorage : IImageStorage
{
    private readonly AmazonS3Client? _client;
    private readonly string? _bucket;
    private readonly string? _publicBaseUrl;

    public S3ImageStorage(IConfiguration configuration)
    {
        var s = configuration.GetSection("Storage");
        string? serviceUrl = s["ServiceUrl"], accessKey = s["AccessKey"], secretKey = s["SecretKey"];
        _bucket = s["Bucket"];
        _publicBaseUrl = s["PublicBaseUrl"]?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(serviceUrl) || string.IsNullOrWhiteSpace(accessKey) || string.IsNullOrWhiteSpace(secretKey)
            || string.IsNullOrWhiteSpace(_bucket) || string.IsNullOrWhiteSpace(_publicBaseUrl))
            return;

        _client = new AmazonS3Client(
            new BasicAWSCredentials(accessKey, secretKey),
            new AmazonS3Config { ServiceURL = serviceUrl, ForcePathStyle = true, AuthenticationRegion = s["Region"] ?? "auto" });
    }

    public bool IsConfigured => _client is not null;

    public async Task<string> UploadAsync(Stream content, string key, string contentType, CancellationToken ct = default)
    {
        if (_client is null) throw new InvalidOperationException("Image storage is not configured.");

        await _client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            DisablePayloadSigning = true, // R2 does not support streaming payload signatures
        }, ct);
        return $"{_publicBaseUrl}/{key}";
    }
}
