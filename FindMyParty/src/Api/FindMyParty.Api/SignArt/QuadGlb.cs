using System.Buffers.Binary;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;

namespace FindMyParty.Api.SignArt;

/// <summary>
/// A GLB holding one upright square: 1 m wide (x from −0.5 to 0.5), 1 m tall (y from 0 to 1), facing +z,
/// double-sided, with the PNG as both its colour and its own light (so the map's light does not dim it). The map
/// scales it to the sign's size. Same layout as <c>quadGlb</c> in the app's <c>tools/city-preview/sign-art.mjs</c>.
/// </summary>
public static class QuadGlb
{
    private const uint Magic = 0x46546c67; // "glTF"
    private const uint JsonChunk = 0x4e4f534a; // "JSON"
    private const uint BinChunk = 0x004e4942; // "BIN\0"

    public static byte[] Build(byte[] png)
    {
        float[] positions = [-0.5f, 0, 0, 0.5f, 0, 0, 0.5f, 1, 0, -0.5f, 1, 0];
        float[] normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
        float[] uvs = [0, 1, 1, 1, 1, 0, 0, 0];
        ushort[] indices = [0, 1, 2, 0, 2, 3];
        byte[][] parts =
        [
            LittleEndian(positions), LittleEndian(normals), LittleEndian(uvs), LittleEndian(indices), png,
        ];

        var offsets = new int[parts.Length];
        var length = 0;
        for (var i = 0; i < parts.Length; i++)
        {
            offsets[i] = length;
            length = Pad4(length + parts[i].Length);
        }
        var bin = new byte[length];
        for (var i = 0; i < parts.Length; i++) parts[i].CopyTo(bin, offsets[i]);

        JsonObject View(int i, int? target = null)
        {
            var view = new JsonObject { ["buffer"] = 0, ["byteOffset"] = offsets[i], ["byteLength"] = parts[i].Length };
            if (target is { } t) view["target"] = t;
            return view;
        }

        var json = new JsonObject
        {
            ["asset"] = new JsonObject { ["version"] = "2.0" },
            ["scene"] = 0,
            ["scenes"] = new JsonArray(new JsonObject { ["nodes"] = new JsonArray(0) }),
            ["nodes"] = new JsonArray(new JsonObject { ["mesh"] = 0 }),
            ["meshes"] = new JsonArray(new JsonObject
            {
                ["primitives"] = new JsonArray(new JsonObject
                {
                    ["attributes"] = new JsonObject { ["POSITION"] = 0, ["NORMAL"] = 1, ["TEXCOORD_0"] = 2 },
                    ["indices"] = 3,
                    ["material"] = 0,
                }),
            }),
            ["materials"] = new JsonArray(new JsonObject
            {
                ["doubleSided"] = true,
                ["pbrMetallicRoughness"] = new JsonObject
                {
                    ["baseColorTexture"] = new JsonObject { ["index"] = 0 },
                    ["metallicFactor"] = 0,
                    ["roughnessFactor"] = 1,
                },
                ["emissiveTexture"] = new JsonObject { ["index"] = 0 },
                ["emissiveFactor"] = new JsonArray(1, 1, 1),
            }),
            ["textures"] = new JsonArray(new JsonObject { ["source"] = 0, ["sampler"] = 0 }),
            ["samplers"] = new JsonArray(new JsonObject { ["magFilter"] = 9729, ["minFilter"] = 9987, ["wrapS"] = 33071, ["wrapT"] = 33071 }),
            ["images"] = new JsonArray(new JsonObject { ["bufferView"] = 4, ["mimeType"] = "image/png" }),
            ["accessors"] = new JsonArray(
                new JsonObject
                {
                    ["bufferView"] = 0, ["componentType"] = 5126, ["count"] = 4, ["type"] = "VEC3",
                    ["min"] = new JsonArray(-0.5, 0, 0), ["max"] = new JsonArray(0.5, 1, 0),
                },
                new JsonObject { ["bufferView"] = 1, ["componentType"] = 5126, ["count"] = 4, ["type"] = "VEC3" },
                new JsonObject { ["bufferView"] = 2, ["componentType"] = 5126, ["count"] = 4, ["type"] = "VEC2" },
                new JsonObject { ["bufferView"] = 3, ["componentType"] = 5123, ["count"] = 6, ["type"] = "SCALAR" }),
            ["bufferViews"] = new JsonArray(View(0, 34962), View(1, 34962), View(2, 34962), View(3, 34963), View(4)),
            ["buffers"] = new JsonArray(new JsonObject { ["byteLength"] = length }),
        };

        // The JSON chunk is padded with spaces, the binary chunk with zeros, both to four bytes.
        var text = Encoding.UTF8.GetBytes(json.ToJsonString());
        var textLength = Pad4(text.Length);
        var total = 12 + 8 + textLength + 8 + bin.Length;

        var glb = new byte[total];
        var span = glb.AsSpan();
        BinaryPrimitives.WriteUInt32LittleEndian(span[0..], Magic);
        BinaryPrimitives.WriteUInt32LittleEndian(span[4..], 2);
        BinaryPrimitives.WriteUInt32LittleEndian(span[8..], (uint)total);
        BinaryPrimitives.WriteUInt32LittleEndian(span[12..], (uint)textLength);
        BinaryPrimitives.WriteUInt32LittleEndian(span[16..], JsonChunk);
        text.CopyTo(span[20..]);
        span.Slice(20 + text.Length, textLength - text.Length).Fill((byte)' ');
        var binStart = 20 + textLength;
        BinaryPrimitives.WriteUInt32LittleEndian(span[binStart..], (uint)bin.Length);
        BinaryPrimitives.WriteUInt32LittleEndian(span[(binStart + 4)..], BinChunk);
        bin.CopyTo(span[(binStart + 8)..]);
        return glb;
    }

    private static int Pad4(int n) => (n + 3) & ~3;

    private static byte[] LittleEndian<T>(T[] values) where T : unmanaged
    {
        if (!BitConverter.IsLittleEndian) throw new PlatformNotSupportedException("GLB needs a little-endian machine.");
        return MemoryMarshal.AsBytes(values.AsSpan()).ToArray();
    }
}
