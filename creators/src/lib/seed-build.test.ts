import assert from "node:assert/strict";
import test from "node:test";
import { buildSeed } from "./seed-build.ts";
import { SHEET_ROWS } from "./sheet-rows.ts";

const EXPECTED = [
  ["Katharine Cruse", "@crusetwins", "#214508", "Approved", "crusek01@gmail.com", "approved", false],
  ["Amber (Places We Found UK)", "@placeswefounduk", "#214506", "Approved", "placeswefounduk@gmail.com", "approved", false],
  ["Em (Emily Blatchford)", "@devon.mum", "#214507?", "Hold", "devonmumem@hotmail.com", "on_hold", false],
  ["Miria Gillespie", "@gillespie.miria", "", "Approved", "missyyyg@icloud.com", "approved", false],
  ["Eva Wright", "@evahegz18", "", "Waiting", "evawright93@gmail.com", "message_needed", false],
  ["Patricia Fale", "@patricia.fale.ugc", "", "Need approve", "patricia.soraia@hotmail.com", "inquiry", false],
  ["Louis", "@lslife9", "", "Need approve (rush)", "louissamrodia@gmail.com", "inquiry", true],
  ["Sam (Ada and Alfie)", "Samantha Starr", "", "Need approve", "samanthastarr75@gmail.com", "inquiry", false],
] as const;

test("the sheet is the eight sample orders, in order, with notes unchanged", () => {
  assert.equal(SHEET_ROWS.length, 8);
  const seed = buildSeed();
  assert.equal(seed.length, 8);
  const ids = new Set(seed.map((row) => row.id));
  assert.equal(ids.size, 8);

  EXPECTED.forEach((expected, index) => {
    const row = SHEET_ROWS[index];
    const creator = seed[index];
    assert.equal(row.name, expected[0]);
    assert.equal(row.handle, expected[1]);
    assert.equal(row.shopifyOrder, expected[2]);
    assert.equal(row.status, expected[3]);
    assert.equal(row.email, expected[4]);
    assert.equal(row.updated, "2026-10-23");
    assert.equal(creator.name, expected[0]);
    assert.equal(creator.stage, expected[5]);
    assert.equal(creator.rush, expected[6]);
    assert.equal(creator.notes, row.notes);
    assert.equal(creator.cardMessage, row.cardMessage);
    assert.equal(creator.handle, row.handle);
  });

  assert.equal(seed[4].cardMessage, "");
  assert.equal(seed[4].notes, "Approved — asked for card message no reply yet");
  assert.match(seed[3].cardMessage, /Poppy xx/);
  assert.match(seed[3].cardMessage, /\n\n/);
  assert.match(seed[5].cardMessage, /17 years together…/);
  assert.match(seed[5].cardMessage, /couldn't/);
  assert.equal(
    seed[6].notes,
    "Birthday Mon 26 Oct — prioritise approve and dispatch so it arrives by then (You Rock birthday cake card)",
  );
  assert.equal(seed[2].notes, "Dispatch Monday — paste note before ship");
  assert.equal(seed[7].notes, "Request comes through as Samantha Starr — approve then ask for card message");
  assert.equal(seed[6].id, "seed-louis");
  assert.equal(seed[7].id, "seed-sam-ada-and-alfie");
});

test("an unknown status is not turned into a creator", () => {
  assert.throws(() =>
    buildSeed([
      {
        name: "Extra",
        handle: "",
        shopifyOrder: "",
        status: "Maybe",
        cardMessage: "",
        notes: "",
        email: "",
        updated: "2026-10-23",
      },
    ]),
  );
});
