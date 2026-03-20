namespace FindMyParty.Parties.API.Infrastructure.Storage;

public interface IS3ImageService
{
    Task<string> UploadAsync(Stream fileStream, string key, string contentType);
}
