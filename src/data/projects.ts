export type Project = {
  slug: string;
  title: string;
  category: string;
  number: string;
  cell: number;
  year: string;
  discipline: string;
  summary: string;
  direction: string;
  deliverables: string[];
  image?: string;
};

// Replace `image` with a file in public/images/work/ when your originals are ready.
// Until then, `cell` selects an AI concept from the temporary artwork sheet.
export const projects: Project[] = [
  { slug: 'flight-control', title: 'The art of engineering.', category: 'Photography', number: '01', cell: 0, year: 'Visual study', discipline: 'Photography / Art direction', summary: 'An exploration of the small details that make extraordinary things possible.', direction: 'Hard light. Deep shadows. A closer look at the architecture of flight. The final collection will feature Dimension’s original hardware photography and editorial graphics.', deliverables: ['Hardware photography', 'Editorial composition', 'Tonal treatment'] },
  { slug: 'after-hours', title: 'Stories after sunset.', category: 'Posters', number: '02', cell: 1, year: 'Visual study', discipline: 'Poster design / Compositing', summary: 'Cinematic worlds built through atmosphere, composition and a little imagination.', direction: 'Layered silhouettes and a focused color palette create depth and tension. This concept stands in for the original cinematic poster collection.', deliverables: ['Poster artwork', 'Image compositing', 'Color exploration'] },
  { slug: 'theelites', title: 'Ideas worth stopping for.', category: 'Social', number: '03', cell: 2, year: 'Visual study', discipline: 'Social design / Content', summary: 'A visual language for technology, ideas and the people moving them forward.', direction: 'A repeatable system of expressive imagery, clear headlines and consistent branding. Original TheElites.in social graphics will replace this concept artwork.', deliverables: ['Social graphics', 'Vertical content covers', 'Design templates'] },
  { slug: 'next-level', title: 'Made for the next click.', category: 'Thumbnails', number: '04', cell: 3, year: 'Visual study', discipline: 'Thumbnail design / Gaming', summary: 'Energy, expression and a strong focal point, composed for a very small canvas.', direction: 'Expressive subjects meet bold type and a high-contrast palette. This is a placeholder for Dimension’s gaming thumbnail work, not a published campaign.', deliverables: ['YouTube thumbnails', 'Gaming visuals', 'Composition variants'] },
  { slug: 'ascend', title: 'Wear a different mindset.', category: 'Posters', number: '05', cell: 4, year: 'Visual study', discipline: 'Apparel / Illustration', summary: 'Sculptural imagery and expressive lettering with something to say.', direction: 'Monochrome texture and selective red accents explore the intersection of poster composition and wearable graphics.', deliverables: ['Apparel graphics', 'Typography studies', 'Print composition'] },
  { slug: 'full-throttle', title: 'Built for the countdown.', category: 'Events', number: '06', cell: 5, year: 'Visual study', discipline: 'Event design / Promotion', summary: 'Bold event identities that make the action feel close before it begins.', direction: 'Motion, condensed typography and a focused accent create a direct promotional language. The finished portfolio will show original tournament and event graphics.', deliverables: ['Event posters', 'Promotional graphics', 'Social adaptations'] },
  { slug: 'radio-control', title: 'Control, in every detail.', category: 'Photography', number: '07', cell: 6, year: 'Visual study', discipline: 'Photography / Editorial', summary: 'A technical object, seen through an editorial lens.', direction: 'Light catches the controls, textures and considered details of the tools behind the flight. An AI concept for the original RC photography series.', deliverables: ['Product photography', 'Technical layout', 'Black-and-white grading'] },
  { slug: 'what-comes-next', title: 'Clarity gets noticed.', category: 'Thumbnails', number: '08', cell: 7, year: 'Visual study', discipline: 'Education / Thumbnails', summary: 'Clear visual priorities for content that helps people find their next step.', direction: 'Readable headlines, approachable imagery and clean visual cues turn complex topics into an immediate invitation to learn.', deliverables: ['Educational thumbnails', 'Headline systems', 'Content covers'] },
  { slug: 'make-some-noise', title: 'A little louder.', category: 'Events', number: '09', cell: 8, year: 'Visual study', discipline: 'Typography / Event graphics', summary: 'An expressive graphic experiment with volume, rhythm and contrast.', direction: 'Oversized type and halftone texture push the composition toward something tactile. Original event work can be added here through the project data file.', deliverables: ['Typographic posters', 'Event artwork', 'Format adaptations'] },
];

export const filters = ['All work', 'Posters', 'Thumbnails', 'Photography', 'Social', 'Events'];
export const artworkPosition = (cell: number) => `${(cell % 3) * 50}% ${Math.floor(cell / 3) * 50}%`;
