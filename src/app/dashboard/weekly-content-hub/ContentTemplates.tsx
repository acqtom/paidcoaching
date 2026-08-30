"use client";

import { ContentDoc, ContentTemplateType } from "./types";

type Data = Record<string, string>;
type SetField = (key: string, value: string) => void;

function useSetter(data: Data, onChange: (data: Data) => void): SetField {
  return (key, value) => onChange({ ...data, [key]: value });
}

// ---------- Shared primitives ----------

function FieldTable({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">{children}</div>;
}

function FieldRow({
  label,
  value,
  onChange,
  multiline,
  highlight,
  narrow,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  highlight?: boolean;
  narrow?: boolean;
}) {
  return (
    <div className={`flex border-b border-gray-100 last:border-b-0 text-sm ${highlight ? "bg-emerald-50/50" : ""}`}>
      <div
        className={`shrink-0 px-3 py-2.5 font-medium text-gray-600 bg-gray-50/60 ${narrow ? "w-16 !bg-blue-50" : "w-1/3"}`}
      >
        {label}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder="Type here…"
          className="flex-1 min-w-0 px-3 py-2.5 outline-none resize-none bg-white text-gray-800 placeholder:text-gray-300 focus:bg-gray-50/80"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type here…"
          className="flex-1 min-w-0 px-3 py-2.5 outline-none bg-white text-gray-800 placeholder:text-gray-300 focus:bg-gray-50/80"
        />
      )}
    </div>
  );
}

const ACCENT_CLASSES = {
  gray: "bg-gray-50",
  amber: "bg-amber-50",
  green: "bg-emerald-50",
  blue: "bg-blue-50",
} as const;

function NoteCard({
  title,
  instruction,
  value,
  onChange,
  accent = "gray",
}: {
  title: string;
  instruction?: string;
  value: string;
  onChange: (v: string) => void;
  accent?: keyof typeof ACCENT_CLASSES;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div className={`px-4 py-2.5 ${ACCENT_CLASSES[accent]}`}>
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        {instruction && <div className="text-xs text-gray-500 italic mt-0.5">{instruction}</div>}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Type here…"
        className="w-full px-4 py-2.5 text-sm outline-none resize-none bg-white text-gray-800 placeholder:text-gray-300 focus:bg-gray-50/50"
      />
    </div>
  );
}

function SectionHeading({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {blurb && <p className="text-xs text-gray-500 mt-1">{blurb}</p>}
    </div>
  );
}

// ---------- Notes for Production / Filming (shared by Video Overview and Ad Overview) ----------

function ProductionNotes({ data, onChange }: { data: Data; onChange: (d: Data) => void }) {
  const set = useSetter(data, onChange);
  return (
    <div>
      <SectionHeading
        title="Notes for Production / Filming"
        blurb="Read each box before filming. Tick the ones that apply to THIS specific video. Not every box applies to every idea, skip what's irrelevant, but address what does."
      />

      <NoteCard
        title="Loom Overview:"
        instruction="Watch this before anything else:"
        value={data.loomOverview ?? ""}
        onChange={(v) => set("loomOverview", v)}
        accent="amber"
      />
      <NoteCard
        title="Example:"
        instruction="Take inspiration from this video regarding HOW this was filmed. Watch how this person presented themselves in the video, watch how they come across. Confidence in yourself, and conviction you're the best at what you do is easy to tell through camera. So show it."
        value={data.example ?? ""}
        onChange={(v) => set("example", v)}
        accent="amber"
      />
      <NoteCard
        title="Story & WHY (not WHAT)"
        instruction="Tell a story and connect on WHY people would want to be like YOU, not just WHAT you do. People follow transformation, not tutorials. Reference the specific moment, decision, or pain point in your journey that this video relates to."
        value={data.storyWhy ?? ""}
        onChange={(v) => set("storyWhy", v)}
        accent="amber"
      />
      <NoteCard
        title="Persona, Like, Know, Trust"
        instruction="People need to like, know, and trust you. That doesn't happen from scripted, lazy filming. What part of your real personality shows up in this video? What opinion/take are you willing to hold that 80% of the niche won't?"
        value={data.personaTrust ?? ""}
        onChange={(v) => set("personaTrust", v)}
        accent="amber"
      />
      <NoteCard
        title="Proof & Receipts:"
        instruction="What screenshots, recipes, student wins, revenue numbers, or DMs can you show on camera to back up what you're saying? Pull them BEFORE filming so you can flow these into the body if needed, don't break flow to look for them."
        value={data.proofReceipts ?? ""}
        onChange={(v) => set("proofReceipts", v)}
        accent="amber"
      />
      <NoteCard
        title="B-Roll / Screen Recordings Needed:"
        instruction="List every screen recording, analytics screenshot, channel example, or external clip you need to film/grab BEFORE the main take so you can talk about them smoothly. Editor cannot invent these later."
        value={data.broll ?? ""}
        onChange={(v) => set("broll", v)}
        accent="amber"
      />
      <NoteCard
        title="Energy & Delivery"
        instruction="Match energy to message. Hook = high. Teaching = grounded and clear. CTA = direct, no apology."
        value={data.energyDelivery ?? ""}
        onChange={(v) => set("energyDelivery", v)}
        accent="amber"
      />
      <NoteCard
        title="Other notes specific to THIS video"
        instruction="Anything else, a guest mention, a callback to a previous video, a specific objection to handle, a metaphor you want to land?"
        value={data.otherNotes ?? ""}
        onChange={(v) => set("otherNotes", v)}
        accent="amber"
      />
    </div>
  );
}

// ---------- Video Overview (Youtube #1/#2: Overview) ----------

function VideoOverviewTemplate({ data, onChange }: { data: Data; onChange: (d: Data) => void }) {
  const set = useSetter(data, onChange);
  return (
    <div>
      <FieldTable>
        <FieldRow label="Video Concept:" value={data.concept ?? ""} onChange={(v) => set("concept", v)} />
        <FieldRow label="Target Audience:" value={data.audience ?? ""} onChange={(v) => set("audience", v)} />
        <FieldRow label="Core Value:" value={data.coreValue ?? ""} onChange={(v) => set("coreValue", v)} />
        <FieldRow label="Why this?" value={data.whyThis ?? ""} onChange={(v) => set("whyThis", v)} />
        <FieldRow label="Record Date:" value={data.recordDate ?? ""} onChange={(v) => set("recordDate", v)} />
        <FieldRow label="Editing Dates:" value={data.editingDates ?? ""} onChange={(v) => set("editingDates", v)} />
        <FieldRow label="Post Date:" value={data.postDate ?? ""} onChange={(v) => set("postDate", v)} />
      </FieldTable>

      <ProductionNotes data={data} onChange={onChange} />
    </div>
  );
}

// ---------- Ad Overview (Ads: Overview) ----------

function AdOverviewTemplate({ data, onChange }: { data: Data; onChange: (d: Data) => void }) {
  const set = useSetter(data, onChange);
  return (
    <div>
      <FieldTable>
        <FieldRow
          label="Campaign Concept:"
          value={data.campaignConcept ?? ""}
          onChange={(v) => set("campaignConcept", v)}
        />
        <FieldRow
          label="Target Audience:"
          value={data.targetAudience ?? ""}
          onChange={(v) => set("targetAudience", v)}
        />
        <FieldRow
          label="Core reason why this will perform:"
          value={data.coreReason ?? ""}
          onChange={(v) => set("coreReason", v)}
        />
        <FieldRow label="Record Date:" value={data.recordDate ?? ""} onChange={(v) => set("recordDate", v)} />
        <FieldRow
          label="Editing Dates:"
          value={data.editingDates ?? ""}
          onChange={(v) => set("editingDates", v)}
        />
        <FieldRow label="Post Date:" value={data.postDate ?? ""} onChange={(v) => set("postDate", v)} />
      </FieldTable>

      <ProductionNotes data={data} onChange={onChange} />
    </div>
  );
}

// ---------- Video Script (Youtube #1/#2: Script) ----------

function VideoScriptTemplate({ data, onChange }: { data: Data; onChange: (d: Data) => void }) {
  const set = useSetter(data, onChange);
  return (
    <div>
      <NoteCard
        title="HOOK (0-15 sec)"
        instruction="Job: stop the scroll and promise the outcome. Restate the title in spoken form, add a specific number/stake, and tease what's coming. No intro. No 'hey guys'. No throat-clearing."
        value={data.hook ?? ""}
        onChange={(v) => set("hook", v)}
        accent="green"
      />
      <NoteCard title="POINT 1" value={data.point1 ?? ""} onChange={(v) => set("point1", v)} />
      <NoteCard title="POINT 2" value={data.point2 ?? ""} onChange={(v) => set("point2", v)} />
      <NoteCard
        title="MID-VIDEO CTA"
        instruction={'Flow into this smooth. Don’t say "1 second guys" or "1 thing real quick". It should be "and if you still…."'}
        value={data.midCta ?? ""}
        onChange={(v) => set("midCta", v)}
        accent="green"
      />
      <NoteCard title="POINT 3" value={data.point3 ?? ""} onChange={(v) => set("point3", v)} />
      <NoteCard title="POINT 4" value={data.point4 ?? ""} onChange={(v) => set("point4", v)} />
      <NoteCard
        title="END CTA"
        instruction={'Flow into this smooth. Don’t say "and that’s it for today’s video" or "and that’s all". It should be "and if you still…."'}
        value={data.endCta ?? ""}
        onChange={(v) => set("endCta", v)}
        accent="green"
      />
    </div>
  );
}

// ---------- Title / Thumb (Youtube #1/#2: Title / Thumb) ----------

function TitleThumbTemplate({ data, onChange }: { data: Data; onChange: (d: Data) => void }) {
  const set = useSetter(data, onChange);
  return (
    <div>
      <SectionHeading
        title="1. Title Ideation"
        blurb="Goal: Draft titles that promise a specific outcome AND trigger curiosity. The viewer should feel they cannot afford to scroll past."
      />
      <p className="text-xs font-semibold text-gray-700 mb-1">Title rules of thumb</p>
      <ul className="text-xs text-gray-500 list-disc pl-4 mb-4 space-y-0.5">
        <li>Lead with the outcome or the stakes (money, time, freedom, status, failure to avoid).</li>
        <li>Use specificity, numbers, timeframes, named results</li>
        <li>Create a curiosity gap, promise the WHAT, hide the HOW.</li>
        <li>Front-load the strongest 3-5 words; mobile cuts the rest.</li>
        <li>Match the title to the thumbnail; together they form ONE hook, not two.</li>
      </ul>

      <p className="text-xs font-semibold text-gray-700 mb-2">Raw title brainstorm</p>
      <FieldTable>
        <FieldRow label="Brainstorm #1" value={data.brainstorm1 ?? ""} onChange={(v) => set("brainstorm1", v)} />
        <FieldRow label="Brainstorm #2" value={data.brainstorm2 ?? ""} onChange={(v) => set("brainstorm2", v)} />
        <FieldRow label="Brainstorm #3" value={data.brainstorm3 ?? ""} onChange={(v) => set("brainstorm3", v)} />
        <FieldRow label="Brainstorm #4" value={data.brainstorm4 ?? ""} onChange={(v) => set("brainstorm4", v)} />
      </FieldTable>

      <FieldTable>
        <div className="px-4 py-2.5 bg-emerald-50 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-800">SEO Ranking</div>
          <div className="text-xs text-gray-500 italic mt-0.5">Has this got important key words that will rank in SEO?</div>
        </div>
        <FieldRow label="Yes / No" value={data.seoYesNo ?? ""} onChange={(v) => set("seoYesNo", v)} />
        <FieldRow
          label="What titles are best for this?"
          value={data.seoBestTitles ?? ""}
          onChange={(v) => set("seoBestTitles", v)}
        />
        <FieldRow label="Why:" value={data.seoWhy ?? ""} onChange={(v) => set("seoWhy", v)} />
      </FieldTable>

      <SectionHeading
        title="2. Title × Thumbnail Combinations"
        blurb="Pair your strongest title drafts with your strongest visual concepts. Pick the three that feel most strong for our ICP, who we are targeting, and who we want to click on the video."
      />

      {[1, 2].map((n) => (
        <div key={n} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2 bg-indigo-50 text-center text-sm font-semibold text-indigo-700 border-b border-gray-100">
            Combination #{n}
          </div>
          <FieldRow
            label="Title:"
            value={data[`combo${n}Title`] ?? ""}
            onChange={(v) => set(`combo${n}Title`, v)}
          />
          <div className="px-4 py-2 bg-indigo-50/60 text-sm font-semibold text-indigo-700 border-t border-gray-100">
            Thumbnail:
          </div>
          <FieldRow label="Face:" value={data[`combo${n}Face`] ?? ""} onChange={(v) => set(`combo${n}Face`, v)} />
          <FieldRow label="Text:" value={data[`combo${n}Text`] ?? ""} onChange={(v) => set(`combo${n}Text`, v)} />
          <FieldRow
            label="Elements / Dashboard"
            value={data[`combo${n}Elements`] ?? ""}
            onChange={(v) => set(`combo${n}Elements`, v)}
          />
          <FieldRow
            label="Other Objects / Logos"
            value={data[`combo${n}Objects`] ?? ""}
            onChange={(v) => set(`combo${n}Objects`, v)}
          />
          <FieldRow
            label="Location:"
            value={data[`combo${n}Location`] ?? ""}
            onChange={(v) => set(`combo${n}Location`, v)}
          />
          <div className="px-4 py-2 bg-indigo-50/60 text-sm font-semibold text-indigo-700 border-t border-gray-100">
            Why this combination works:
          </div>
          <textarea
            value={data[`combo${n}Why`] ?? ""}
            onChange={(e) => set(`combo${n}Why`, e.target.value)}
            rows={2}
            placeholder="Type here…"
            className="w-full text-sm p-3 outline-none resize-none bg-white text-gray-800 placeholder:text-gray-300 focus:bg-gray-50/50"
          />
        </div>
      ))}
    </div>
  );
}

// ---------- Instagram Scripts / Stories ----------

function ScriptSequenceTemplate({
  data,
  onChange,
  blockLabel,
}: {
  data: Data;
  onChange: (d: Data) => void;
  blockLabel: string;
}) {
  const set = useSetter(data, onChange);
  return (
    <div>
      <NoteCard
        title="Loom Overview:"
        instruction="Watch this before anything else:"
        value={data.loomOverview ?? ""}
        onChange={(v) => set("loomOverview", v)}
        accent="blue"
      />

      {[1, 2, 3].map((n) => (
        <div key={n} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2 bg-amber-50 text-center text-sm font-semibold text-gray-800 border-b border-gray-100">
            {blockLabel} #{n}
          </div>
          <FieldRow
            label="Concept:"
            value={data[`s${n}Concept`] ?? ""}
            onChange={(v) => set(`s${n}Concept`, v)}
            highlight
          />
          <div className="px-4 py-2 bg-amber-50/60 text-sm font-semibold text-gray-700 border-t border-gray-100">
            Visual:
          </div>
          <textarea
            value={data[`s${n}Visual`] ?? ""}
            onChange={(e) => set(`s${n}Visual`, e.target.value)}
            rows={2}
            placeholder="Type here…"
            className="w-full text-sm p-3 outline-none resize-none bg-white text-gray-800 placeholder:text-gray-300 focus:bg-gray-50/50"
          />
          <div className="px-4 py-2 bg-amber-50/60 text-sm font-semibold text-gray-700 border-t border-gray-100">
            Script:
          </div>
          <textarea
            value={data[`s${n}Script`] ?? ""}
            onChange={(e) => set(`s${n}Script`, e.target.value)}
            rows={3}
            placeholder="Type here…"
            className="w-full text-sm p-3 outline-none resize-none bg-white text-gray-800 placeholder:text-gray-300 focus:bg-gray-50/50"
          />
        </div>
      ))}
    </div>
  );
}

// ---------- Ad Scripts ----------

function AdScriptTemplate({ data, onChange }: { data: Data; onChange: (d: Data) => void }) {
  const set = useSetter(data, onChange);
  return (
    <div>
      <FieldTable>
        <FieldRow
          label="Campaign Concept:"
          value={data.campaignConcept ?? ""}
          onChange={(v) => set("campaignConcept", v)}
        />
        <FieldRow
          label="Target Audience:"
          value={data.targetAudience ?? ""}
          onChange={(v) => set("targetAudience", v)}
        />
        <FieldRow
          label="Core reason why this will perform:"
          value={data.coreReason ?? ""}
          onChange={(v) => set("coreReason", v)}
        />
        <FieldRow label="Record Date:" value={data.recordDate ?? ""} onChange={(v) => set("recordDate", v)} />
        <FieldRow
          label="Editing Dates:"
          value={data.editingDates ?? ""}
          onChange={(v) => set("editingDates", v)}
        />
        <FieldRow label="Post Date:" value={data.postDate ?? ""} onChange={(v) => set("postDate", v)} />
      </FieldTable>

      <FieldTable>
        <div className="px-4 py-2 bg-amber-50 text-center text-sm font-semibold text-gray-800 border-b border-gray-100">
          Hooks:
        </div>
        {["H1", "H2", "H3", "H4", "H5"].map((k) => (
          <FieldRow key={k} label={k} narrow value={data[`hook${k}`] ?? ""} onChange={(v) => set(`hook${k}`, v)} />
        ))}
      </FieldTable>

      <FieldTable>
        <div className="px-4 py-2 bg-amber-50 text-center text-sm font-semibold text-gray-800 border-b border-gray-100">
          Body:
        </div>
        {["B1", "B2", "B3"].map((k) => (
          <FieldRow
            key={k}
            label={k}
            narrow
            multiline
            value={data[`body${k}`] ?? ""}
            onChange={(v) => set(`body${k}`, v)}
          />
        ))}
      </FieldTable>

      <FieldTable>
        <div className="px-4 py-2 bg-amber-50 text-center text-sm font-semibold text-gray-800 border-b border-gray-100">
          Closes:
        </div>
        {["C1", "C2"].map((k) => (
          <FieldRow
            key={k}
            label={k}
            narrow
            multiline
            value={data[`close${k}`] ?? ""}
            onChange={(v) => set(`close${k}`, v)}
          />
        ))}
      </FieldTable>
    </div>
  );
}

// ---------- Dispatcher ----------

interface Props {
  doc: ContentDoc;
  onChange: (templateData: Data) => void;
}

export default function ContentTemplateRenderer({ doc, onChange }: Props) {
  const data = doc.templateData ?? {};
  const type: ContentTemplateType | undefined = doc.templateType;

  switch (type) {
    case "videoOverview":
      return <VideoOverviewTemplate data={data} onChange={onChange} />;
    case "adOverview":
      return <AdOverviewTemplate data={data} onChange={onChange} />;
    case "videoScript":
      return <VideoScriptTemplate data={data} onChange={onChange} />;
    case "titleThumb":
      return <TitleThumbTemplate data={data} onChange={onChange} />;
    case "instagramScript":
      return <ScriptSequenceTemplate data={data} onChange={onChange} blockLabel="Script" />;
    case "instagramStories":
      return <ScriptSequenceTemplate data={data} onChange={onChange} blockLabel="Story Sequence" />;
    case "adScript":
      return <AdScriptTemplate data={data} onChange={onChange} />;
    default:
      return null;
  }
}
