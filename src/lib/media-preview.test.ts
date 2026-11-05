import assert from "node:assert/strict";
import test from "node:test";
import {
  creativeVideoSources,
  mediaByteResponse,
  parseByteRange,
  swipeAxis,
  swipeStep,
  videoPreviewFor,
} from "./media-preview.ts";

test("a sideways finger changes slides and a vertical one does not", () => {
  assert.equal(swipeAxis(2, 1), null);
  assert.equal(swipeAxis(30, 6), "horizontal");
  assert.equal(swipeAxis(6, 30), "vertical");
  assert.equal(swipeAxis(20, 20), "vertical");
  assert.equal(swipeStep(60), -1);
  assert.equal(swipeStep(-60), 1);
  assert.equal(swipeStep(20), 0);
});

test("video bytes answer a phone range request", async () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(parseByteRange(null, bytes.length), null);
  assert.deepEqual(parseByteRange("bytes=0-3", bytes.length), { start: 0, end: 3 });
  assert.deepEqual(parseByteRange("bytes=4-", bytes.length), { start: 4, end: 9 });
  assert.deepEqual(parseByteRange("bytes=-3", bytes.length), { start: 7, end: 9 });
  assert.equal(parseByteRange("bytes=0-99", bytes.length)?.end, 9);
  assert.equal(parseByteRange("bytes=20-", bytes.length), "unsatisfiable");

  const full = mediaByteResponse(bytes, "video/mp4", "clip.mp4", null);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  assert.equal(full.headers.get("content-length"), "10");
  assert.equal(full.headers.get("content-disposition"), 'inline; filename="clip.mp4"');

  const partial = mediaByteResponse(bytes, "video/mp4", "clip.mp4", "bytes=2-5");
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("content-range"), "bytes 2-5/10");
  assert.deepEqual([...(new Uint8Array(await partial.arrayBuffer()))], [2, 3, 4, 5]);

  const missing = mediaByteResponse(bytes, "video/mp4", "clip.mp4", "bytes=40-");
  assert.equal(missing.status, 416);
  assert.equal(missing.headers.get("content-range"), "bytes */10");
});

test("creative video links become an in-app player", () => {
  assert.equal(videoPreviewFor("not a url"), null);
  assert.equal(videoPreviewFor("javascript:alert(1)"), null);
  assert.equal(videoPreviewFor("https://example.com/notes"), null);

  const youtube = videoPreviewFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(youtube?.kind, "iframe");
  assert.equal(youtube?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(videoPreviewFor("https://youtu.be/dQw4w9WgXcQ")?.src, youtube?.src);
  assert.equal(videoPreviewFor("https://www.youtube.com/shorts/abcdefghijk")?.shape, "tall");

  assert.equal(videoPreviewFor("https://vimeo.com/123456")?.src, "https://player.vimeo.com/video/123456");
  assert.equal(
    videoPreviewFor("https://drive.google.com/file/d/abc_DEF-1/view")?.src,
    "https://drive.google.com/file/d/abc_DEF-1/preview",
  );
  assert.equal(
    videoPreviewFor("https://www.tiktok.com/@mailbakes/video/1234567890")?.src,
    "https://www.tiktok.com/embed/v2/1234567890",
  );
  assert.equal(videoPreviewFor("https://cdn.example.com/bake.mp4")?.kind, "file");
  assert.equal(videoPreviewFor("https://www.dropbox.com/s/xyz/bake.mp4?dl=0")?.kind, "file");
  assert.match(videoPreviewFor("https://www.dropbox.com/s/xyz/bake.mp4?dl=0")?.src ?? "", /raw=1/);

  const notes = "Longer cut: https://youtu.be/dQw4w9WgXcQ. Also https://cdn.example.com/bake.mp4.";
  const sources = creativeVideoSources(notes);
  assert.equal(sources.length, 2);
  assert.equal(sources[0]?.title, "YouTube");
  assert.equal(sources[1]?.src, "https://cdn.example.com/bake.mp4");
  assert.equal(creativeVideoSources(`${notes} ${notes}`).length, 2);
});
