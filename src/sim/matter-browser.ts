import Phaser from 'phaser';

// Phaser's bundled Matter.js (Phaser fork of Matter 0.20). See vite.config.ts.
const Matter: any = (Phaser as any).Physics.Matter.Matter;
export default Matter;
