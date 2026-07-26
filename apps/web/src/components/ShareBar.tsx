// The share row is shared with the transactional app — one implementation, one
// set of networks, one look. Kept as a re-export so the ~3 call sites here read
// as local components like the rest of this directory.
export { ShareBar } from '@retail-os/ui-react';
