import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';

export const SCENE_DURATIONS: Record<string, number> = {
  prep: 11000,
  live: 13000,
  dialer: 9000,
  vault: 10000,
  debrief: 12000,
  team: 11000,
  close: 6000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  prep: Scene1,
  live: Scene2,
  dialer: Scene3,
  vault: Scene4,
  debrief: Scene5,
  team: Scene6,
  close: Scene7,
};

const scenePositions = [
  { x: '45vw', y: '42vh', scale: 2.8, opacity: 0.06 },
  { x: '8vw',  y: '15vh', scale: 1.3, opacity: 0.05 },
  { x: '72vw', y: '55vh', scale: 1.6, opacity: 0.04 },
  { x: '20vw', y: '65vh', scale: 1.1, opacity: 0.05 },
  { x: '60vw', y: '20vh', scale: 2.0, opacity: 0.03 },
  { x: '15vw', y: '35vh', scale: 1.4, opacity: 0.05 },
  { x: '50vw', y: '50vh', scale: 3.0, opacity: 0.08 },
];

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const pos = scenePositions[sceneIndex] ?? scenePositions[0];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-brand-bg">
      {/* Persistent drifting background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute rounded-full blur-[100px]"
          style={{
            width: '70vw',
            height: '70vw',
            background: 'radial-gradient(circle, var(--brand-gold), transparent 70%)',
            opacity: 0.04,
          }}
          animate={{ x: ['-20%', '20%', '-10%'], y: ['-20%', '10%', '-30%'], scale: [1, 1.2, 0.9] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute rounded-full blur-[120px] right-0 bottom-0"
          style={{
            width: '55vw',
            height: '55vw',
            background: 'radial-gradient(circle, var(--brand-blue), transparent 70%)',
            opacity: 0.025,
          }}
          animate={{ x: ['20%', '-10%', '10%'], y: ['20%', '-20%', '0%'] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        />
        {/* Gold grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              'linear-gradient(var(--brand-gold) 1px, transparent 1px), linear-gradient(90deg, var(--brand-gold) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Persistent midground orb — transforms with scene */}
      <motion.div
        className="absolute rounded-full blur-[70px] pointer-events-none"
        style={{ width: '18vw', height: '18vw', background: 'var(--brand-gold)' }}
        animate={pos}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
