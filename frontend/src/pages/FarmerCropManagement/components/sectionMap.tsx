// import React, { useMemo, useState } from "react";
// import {
//   Box,
//   Grid,
//   GridItem,
//   Heading,
//   HStack,
//   NumberInput,
//   chakra,
//   Button,
//   ChakraProvider,
//   createSystem,
//   defaultConfig,
// } from "@chakra-ui/react";
// import { ThemeProvider } from "next-themes";

// type Pt = { x: number; y: number };

// const system = createSystem(defaultConfig, {});

// export function LandMapperProvider({ children }: { children: React.ReactNode }) {
//   return (
//     <ChakraProvider value={system}>
//       <ThemeProvider attribute="class" defaultTheme="system">{children}</ThemeProvider>
//     </ChakraProvider>
//   );
// }

// // Build polygon from four side lengths (top, right, bottom, left).
// // If a side is 0, the polygon degenerates (e.g., triangle).
// function makePolygon(top: number, right: number, bottom: number, left: number): Pt[] {
//   const pts: Pt[] = [{ x: 0, y: 0 }];
//   if (top > 0) pts.push({ x: top, y: 0 });
//   if (right > 0) pts.push({ x: top, y: right });
//   if (bottom > 0) pts.push({ x: 0, y: right });
//   if (left > 0 && pts.length < 4) pts.push({ x: 0, y: 0 });
//   return pts;
// }

// export default function App() {
//   return (
//     <LandMapperProvider>
//       <LandShapeInput />
//     </LandMapperProvider>
//   );
// }

// function LandShapeInput() {
//   const [top, setTop] = useState(100);
//   const [right, setRight] = useState(80);
//   const [bottom, setBottom] = useState(100);
//   const [left, setLeft] = useState(80);
//   const [pts, setPts] = useState<Pt[]>(makePolygon(100, 80, 100, 80));

//   const polygon = useMemo(() => {
//     const closed = [...pts, pts[0]];
//     return closed.map((p) => `${p.x},${p.y}`).join(" ");
//   }, [pts]);

//   const handleGenerate = () => {
//     setPts(makePolygon(top, right, bottom, left));
//   };

//   return (
//     <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6} p={6}>
//       <GridItem>
//         <Box bg="bg" rounded="xl" p={4} borderWidth="1px">
//           <Heading size="md" mb={4}>Enter side distances</Heading>
//           <HStack gap={3} mb={3} justify="center">
//             <NumberInput.Root value={String(top)} onValueChange={({ valueAsNumber }) => setTop(valueAsNumber ?? 0)}>
//               <NumberInput.Input placeholder="Top" />
//             </NumberInput.Root>
//           </HStack>
//           <HStack gap={3} mb={3} justify="space-between">
//             <NumberInput.Root value={String(left)} onValueChange={({ valueAsNumber }) => setLeft(valueAsNumber ?? 0)}>
//               <NumberInput.Input placeholder="Left" />
//             </NumberInput.Root>
//             <NumberInput.Root value={String(right)} onValueChange={({ valueAsNumber }) => setRight(valueAsNumber ?? 0)}>
//               <NumberInput.Input placeholder="Right" />
//             </NumberInput.Root>
//           </HStack>
//           <HStack gap={3} mb={3} justify="center">
//             <NumberInput.Root value={String(bottom)} onValueChange={({ valueAsNumber }) => setBottom(valueAsNumber ?? 0)}>
//               <NumberInput.Input placeholder="Bottom" />
//             </NumberInput.Root>
//           </HStack>
//           <Button onClick={handleGenerate}>Generate</Button>

//           <chakra.svg width="100%" height="320px" viewBox={`0 0 ${Math.max(top, bottom) + 20} ${Math.max(right, left) + 20}`} bg="gray.50" _dark={{ bg: "gray.800" }}>
//             <polyline points={polygon} fill="rgba(56,161,105,0.15)" stroke="#48BB78" strokeWidth={2} />
//             {pts.map((p, i) => (
//               <g key={i}>
//                 <circle cx={p.x} cy={p.y} r={5} fill="#2F855A" stroke="white" strokeWidth={2} />
//                 <text x={p.x + 6} y={p.y - 6} fontSize={12} fill="currentColor">{"ABCD"[i]}</text>
//               </g>
//             ))}
//           </chakra.svg>
//         </Box>
//       </GridItem>
//     </Grid>
//   );
// }


// // =============================
// // Section Planner Component
// // - Renders a land polygon and existing sections
// // - Shows an automatically computed "Unassigned" area (land \ union(sections))
// // - Lets the farmer add a new section by:
// //    1) entering target sides (AB,BC,CD,DA)
// //    2) clicking a start point to seed a rectangle template
// //    3) dragging the new section's corners to adjust
// // - On save, validates containment & overlap, then updates sections
// //
// // NOTE: uses `polygon-clipping` for geometric boolean ops.
// // =============================

// import * as pc from "polygon-clipping"; // npm i polygon-clipping

// export type Polygon = Pt[]; // simple ring, assumed clockwise, non-self-intersecting

// export type Section = {
//   id: string;
//   name: string;
//   color: string; // fill color
//   polygon: Polygon; // local coordinates (same units as land)
// };

// export type SectionPlannerProps = {
//   land: Polygon;
//   sections: Section[];
//   onChange?: (next: { sections: Section[]; unassigned: Polygon[] }) => void;
// };

// // Helpers to convert between our Polygon and polygon-clipping MultiPolygon format
// function toPC(p: Polygon): pc.Polygon {
//   return [p.map((pt) => [pt.x, pt.y])]; // a single ring polygon
// }
// function fromPC(mp: pc.MultiPolygon): Polygon[] {
//   // Take only outer rings from possibly multiple polygons; ignore holes for simplicity UI
//   const res: Polygon[] = [];
//   for (const poly of mp) {
//     const outer = poly[0];
//     res.push(outer.map(([x, y]) => ({ x, y })));
//   }
//   return res;
// }

// function union(polys: Polygon[]): pc.MultiPolygon {
//   if (polys.length === 0) return [] as unknown as pc.MultiPolygon;
//   let acc = toPC(polys[0]);
//   for (let i = 1; i < polys.length; i++) acc = pc.union(acc, toPC(polys[i])) as pc.MultiPolygon;
//   return acc;
// }

// function difference(a: Polygon, subtract: Polygon[]): Polygon[] {
//   if (subtract.length === 0) return [a];
//   const sub = union(subtract);
//   const diff = pc.difference(toPC(a), sub) as pc.MultiPolygon;
//   return fromPC(diff);
// }

// function polygonArea(poly: Polygon): number {
//   return shoelaceArea(poly);
// }

// function within(land: Polygon, poly: Polygon): boolean {
//   // Strict containment test using area equality after clipping
//   const clipped = pc.intersection(toPC(land), toPC(poly)) as pc.MultiPolygon;
//   const clippedPolys = fromPC(clipped);
//   const areaClipped = clippedPolys.reduce((s, p) => s + polygonArea(p), 0);
//   const areaPoly = polygonArea(poly);
//   return Math.abs(areaClipped - areaPoly) < 1e-6;
// }

// function overlapsAny(polys: Polygon[], poly: Polygon): boolean {
//   for (const p of polys) {
//     const inter = pc.intersection(toPC(p), toPC(poly)) as pc.MultiPolygon;
//     if (inter && (inter as any).length) {
//       const total = fromPC(inter).reduce((s, r) => s + polygonArea(r), 0);
//       if (total > 1e-6) return true;
//     }
//   }
//   return false;
// }

// export function SectionPlanner({ land, sections: initial, onChange }: SectionPlannerProps) {
//   const [sections, setSections] = useState<Section[]>(initial);
//   const unassigned = useMemo(() => difference(land, sections.map((s) => s.polygon)), [land, sections]);

//   // New section draft
//   const [draft, setDraft] = useState<Polygon | null>(null);
//   const [targets, setTargets] = useState({ AB: 40, BC: 30, CD: 40, DA: 30 });

//   const startDraftAt = (p: Pt) => {
//     const { AB, BC } = targets;
//     setDraft([
//       { x: p.x, y: p.y },
//       { x: p.x + AB, y: p.y },
//       { x: p.x + AB, y: p.y + BC },
//       { x: p.x, y: p.y + BC },
//     ]);
//   };

//   // Render helpers
//   const proj = useMemo(() => makeProjector(land), [land]);

//   const saveDraft = () => {
//     if (!draft) return;
//     // Validate
//     if (!within(land, draft)) {
//       alert("Section must lie within land boundary.");
//       return;
//     }
//     if (overlapsAny(sections.map((s) => s.polygon), draft)) {
//       alert("Section overlaps an existing section.");
//       return;
//     }
//     const id = `S${sections.length + 1}`;
//     const color = ["#3182CE", "#38A169", "#D69E2E", "#DD6B20", "#805AD5"][sections.length % 5];
//     const next = [...sections, { id, name: `Section ${id}`, color, polygon: draft }];
//     setSections(next);
//     setDraft(null);
//     onChange?.({ sections: next, unassigned: difference(land, next.map((s) => s.polygon)) });
//   };

//   // Dragging draft corners
//   function useDragPoint(idx: number) {
//     const { onPointerDown, onPointerMove, onPointerUp } = useDrag((dx, dy) => {
//       if (!draft) return;
//       const scale = (() => {
//         const p0 = proj({ x: 0, y: 0 });
//         const p1 = proj({ x: 1, y: 0 });
//         return Math.hypot(p1.x - p0.x, p1.y - p0.y);
//       })();
//       const wdx = dx / scale;
//       const wdy = -dy / scale;
//       setDraft((prev) => (prev ? prev.map((pt, i) => (i === idx ? { x: pt.x + wdx, y: pt.y + wdy } : pt)) : prev));
//     });
//     return { onPointerDown, onPointerMove, onPointerUp };
//   }

//   // Edge labels for draft
//   const draftLengths = useMemo(() => (draft ? edgeLengths(draft) : []), [draft]);

//   return (
//     <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap={6} p={6}>
//       <GridItem>
//         <Box bg="bg" rounded="xl" p={4} borderWidth="1px">
//           <Heading size="md" mb={3}>Land & Sections</Heading>
//           <chakra.svg width="100%" height="520px" viewBox={`0 0 720 520`} bg="bg.subtle">
//             {/* land */}
//             <polyline points={[...land, land[0]].map((p) => { const s = proj(p); return `${s.x},${s.y}`; }).join(" ")} fill="rgba(0,0,0,0.04)" stroke="#4A5568" strokeWidth={2} />

//             {/* existing sections */}
//             {sections.map((s, i) => (
//               <g key={s.id}>
//                 <polyline points={[...s.polygon, s.polygon[0]].map((p) => { const sp = proj(p); return `${sp.x},${sp.y}`; }).join(" ")} fill={s.color+"33"} stroke={s.color} strokeWidth={2} />
//                 {/* label */}
//                 {(() => {
//                   const c = centroid(s.polygon);
//                   const sc = proj(c);
//                   return <text x={sc.x} y={sc.y} textAnchor="middle" fontSize={12} fill="#1A202C">{s.name}</text>;
//                 })()}
//               </g>
//             ))}

//             {/* unassigned areas (could be multiple after subtraction) */}
//             {unassigned.map((poly, idx) => (
//               <polyline key={`un-${idx}`} points={[...poly, poly[0]].map((p) => { const sp = proj(p); return `${sp.x},${sp.y}`; }).join(" ")} fill="#A0AEC044" stroke="#A0AEC0" strokeDasharray="6 6" />
//             ))}

//             {/* Draft */}
//             {draft && (
//               <g>
//                 <polyline points={[...draft, draft[0]].map((p) => { const sp = proj(p); return `${sp.x},${sp.y}`; }).join(" ")} fill="rgba(56,161,105,0.18)" stroke="#2F855A" strokeWidth={2} />
//                 {/* edge labels */}
//                 {draft.map((p, i) => {
//                   const q = draft[(i + 1) % draft.length];
//                   const mid = proj({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
//                   const actual = draftLengths[i]?.toFixed(1);
//                   const lbl = ["AB","BC","CD","DA"][i];
//                   return <text key={`dlen-${i}`} x={mid.x} y={mid.y} fontSize={12} fill="#2F855A" textAnchor="middle">{lbl}: {actual}</text>;
//                 })}
//                 {/* handles */}
//                 {draft.map((p, i) => {
//                   const sp = proj(p);
//                   const drag = useDragPoint(i);
//                   return <circle key={`dh-${i}`} cx={sp.x} cy={sp.y} r={7} fill="#2F855A" stroke="white" strokeWidth={2} style={{ cursor: "grab" }} {...drag} />;
//                 })}
//               </g>
//             )}
//           </chakra.svg>
//         </Box>
//       </GridItem>

//       <GridItem>
//         <VStack align="stretch" gap={4}>
//           <Box bg="bg" rounded="xl" p={4} borderWidth="1px">
//             <Heading size="sm" mb={3}>Add section</Heading>
//             <HStack>
//               {(["AB","BC","CD","DA"] as const).map((k) => (
//                 <NumberInput.Root key={k} value={String(targets[k])} onValueChange={({ valueAsNumber }) => setTargets((t) => ({ ...t, [k]: valueAsNumber ?? 0 }))}>
//                   <NumberInput.Input placeholder={k} />
//                   <NumberInput.Control>
//                     <NumberInput.IncrementTrigger />
//                     <NumberInput.DecrementTrigger />
//                   </NumberInput.Control>
//                 </NumberInput.Root>
//               ))}
//             </HStack>
//             <Text mt={2} fontSize="sm" color="fg.muted">Click on the canvas to set the top-left corner (A). Drag the handles to adjust. Then Save.</Text>
//             <HStack mt={3}>
//               <Button onClick={() => setDraft(null)} variant="outline">Clear</Button>
//               <Button colorScheme="green" onClick={saveDraft} isDisabled={!draft}>Save Section</Button>
//             </HStack>
//           </Box>

//           <Box bg="bg" rounded="xl" p={4} borderWidth="1px">
//             <Heading size="sm" mb={3}>Unassigned
//             </Heading>
//             <Text fontSize="sm" color="fg.muted">Shown in grey. It’s computed as land minus all sections. Adding a new section updates this automatically.</Text>
//           </Box>
//         </VStack>
//       </GridItem>
//     </Grid>
//   );
// }

// // =============================
// // Mock Data + Example Usage
// // =============================

// export function ExampleSectionPlanner() {
//   // Land polygon (rough trapezoid)
//   const land: Polygon = [
//     { x: 0, y: 0 },
//     { x: 220, y: 20 },
//     { x: 200, y: 160 },
//     { x: -20, y: 140 },
//   ];

//   const sections: Section[] = [
//     {
//       id: "S1",
//       name: "Section S1",
//       color: "#3182CE",
//       polygon: [
//         { x: 10, y: 10 },
//         { x: 90, y: 10 },
//         { x: 90, y: 60 },
//         { x: 10, y: 60 },
//       ],
//     },
//     {
//       id: "S2",
//       name: "Section S2",
//       color: "#38A169",
//       polygon: [
//         { x: 110, y: 20 },
//         { x: 170, y: 25 },
//         { x: 165, y: 70 },
//         { x: 105, y: 65 },
//       ],
//     },
//     {
//       id: "S3",
//       name: "Section S3",
//       color: "#D69E2E",
//       polygon: [
//         { x: 30, y: 80 },
//         { x: 90, y: 80 },
//         { x: 90, y: 120 },
//         { x: 30, y: 120 },
//       ],
//     },
//   ];

//   return (
//     <LandMapperProvider>
//       <SectionPlanner land={land} sections={sections} onChange={(next) => console.log("sections", next)} />
//     </LandMapperProvider>
//   );
// }
