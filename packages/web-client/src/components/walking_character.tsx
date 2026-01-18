/**
 * Walking characters component for the Village theme.
 * Renders multiple squares (one per agent/signpost) walking along roads.
 * Uses ReactFlow's viewport transform to stay aligned with pan/zoom.
 */
import { type Node, useStore } from '@xyflow/react';
import { type FC, useEffect, useRef } from 'react';

import { type RoadNetworkData } from '../hooks/use_isometric_layout';
import { type CharacterState, useWalkingCharacters } from '../hooks/use_walking_characters';

import { type MetadataNodeData } from './todo_graph_metadata_node';

/** Viewport transform tuple */
interface ViewportTransform {
  tx: number;
  ty: number;
  scale: number;
}

/** Transform screen coordinates to viewport coordinates */
const toViewport = (x: number, y: number, vt: ViewportTransform) => ({
  x: x * vt.scale + vt.tx,
  y: y * vt.scale + vt.ty,
});

/** Colors for different characters */
const COLORS = [
  { bg: '#e74c3c', border: '#c0392b' },
  { bg: '#3498db', border: '#2980b9' },
  { bg: '#2ecc71', border: '#27ae60' },
  { bg: '#9b59b6', border: '#8e44ad' },
  { bg: '#f39c12', border: '#d68910' },
  { bg: '#1abc9c', border: '#16a085' },
];

interface PathVisualizationProps {
  viewPath: Array<{ x: number; y: number }>;
  pathIndex: number;
  color: { bg: string; border: string };
}

/** Path line and waypoints */
const PathVisualization: FC<PathVisualizationProps> = ({ viewPath, pathIndex, color }) => {
  if (viewPath.length <= 1) return null;
  return (
    <>
      <polyline
        fill="none"
        points={viewPath.map((p) => `${p.x},${p.y}`).join(' ')}
        stroke={color.bg}
        strokeDasharray="4 4"
        strokeOpacity={0.4}
        strokeWidth={2}
      />
      {viewPath.map((pos, idx) => (
        <circle
          cx={pos.x}
          cy={pos.y}
          fill={idx < pathIndex ? '#27ae60' : color.bg}
          key={idx}
          opacity={0.5}
          r={3}
        />
      ))}
    </>
  );
};

interface CharacterSquareProps {
  viewPos: { x: number; y: number };
  scale: number;
  color: { bg: string; border: string };
  isOnHouse: boolean;
}

/** The character square */
const CharacterSquare: FC<CharacterSquareProps> = ({ viewPos, scale, color, isOnHouse }) => {
  const size = 14;
  return (
    <rect
      fill={color.bg}
      height={size * scale}
      opacity={isOnHouse ? 0 : 1}
      rx={2 * scale}
      stroke={color.border}
      strokeWidth={2 * scale}
      style={{ transition: 'x 180ms ease-out, y 180ms ease-out, opacity 300ms ease-out' }}
      width={size * scale}
      x={viewPos.x - (size * scale) / 2}
      y={viewPos.y - (size * scale) / 2}
    />
  );
};

interface SpeechBubbleProps {
  viewPos: { x: number; y: number };
  message: string;
  animate: boolean;
}

/** Speech bubble rendered as absolute positioned div outside SVG */
const SpeechBubble: FC<SpeechBubbleProps> = ({ viewPos, message, animate }) => {
  const bubbleWidth = 200;
  return (
    <div
      style={{
        position: 'absolute',
        left: viewPos.x - bubbleWidth / 2,
        top: viewPos.y - 90,
        width: bubbleWidth,
        transition: animate ? 'left 180ms ease-out, top 180ms ease-out' : 'none',
        pointerEvents: 'none',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: '#fffbeb',
          border: '2px solid #d97706',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          color: '#78350f',
          boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
          maxHeight: 70,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}
      >
        {message}
      </div>
      {/* Triangle pointer */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid #d97706',
          margin: '0 auto',
        }}
      />
    </div>
  );
};

interface SingleCharacterProps {
  character: CharacterState;
  colorIndex: number;
  vt: ViewportTransform;
}

/** Single walking character with its path (SVG only, no bubble) */
const SingleCharacter: FC<SingleCharacterProps> = ({ character, colorIndex, vt }) => {
  const color = COLORS[colorIndex % COLORS.length];
  const viewPos = toViewport(character.screenPos.x, character.screenPos.y, vt);
  const viewPath = character.path.map((p) => toViewport(p.x, p.y, vt));

  return (
    <g>
      <PathVisualization color={color} pathIndex={character.pathIndex} viewPath={viewPath} />
      <CharacterSquare
        color={color}
        isOnHouse={character.isOnHouse}
        scale={vt.scale}
        viewPos={viewPos}
      />
    </g>
  );
};

/** Build map of metadata node id -> lastMessage */
const buildMessageMap = (nodes: Node[]): Map<string, string> => {
  const messageMap = new Map<string, string>();
  for (const node of nodes) {
    if (node.type === 'metadataNode') {
      const data = node.data as unknown as MetadataNodeData;
      if (data.lastMessage) {
        messageMap.set(node.id, data.lastMessage);
      }
    }
  }
  return messageMap;
};

/** Find the character that should show the speech bubble */
const findBubbleCharacter = (
  characters: CharacterState[],
  messageMap: Map<string, string>,
): CharacterState | undefined => {
  return characters.find(
    (c) => c.isWalking && messageMap.has(c.id) && !c.isOnHouse && c.hasBubblePermission,
  );
};

interface WalkingCharactersProps {
  roadNetwork: RoadNetworkData;
  nodes: Node[];
}

/** Container for all walking characters */
export const WalkingCharacter: FC<WalkingCharactersProps> = ({ roadNetwork, nodes }) => {
  const { characters } = useWalkingCharacters(roadNetwork);
  const transform = useStore((state) => state.transform) as [number, number, number];
  const vt: ViewportTransform = { tx: transform[0], ty: transform[1], scale: transform[2] };
  const prevBubbleCharIdRef = useRef<string | null>(null);

  const messageMap = buildMessageMap(nodes);
  const bubbleChar = findBubbleCharacter(characters, messageMap);
  const bubbleMessage = bubbleChar ? messageMap.get(bubbleChar.id) : undefined;
  const bubbleViewPos = bubbleChar
    ? toViewport(bubbleChar.screenPos.x, bubbleChar.screenPos.y, vt)
    : null;

  // Only animate if bubble stays with the same character
  const bubbleCharId = bubbleChar?.id ?? null;
  const shouldAnimate = bubbleCharId !== null && bubbleCharId === prevBubbleCharIdRef.current;

  // Update ref for next render
  useEffect(() => {
    prevBubbleCharIdRef.current = bubbleCharId;
  }, [bubbleCharId]);

  if (characters.length === 0) return null;

  return (
    <>
      {/* Characters and paths (SVG) */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        {characters.map((char, idx) => (
          <SingleCharacter character={char} colorIndex={idx} key={char.id} vt={vt} />
        ))}
      </svg>
      {/* Speech bubble (HTML for smooth transitions) */}
      {bubbleChar && bubbleMessage && bubbleViewPos && (
        <SpeechBubble animate={shouldAnimate} message={bubbleMessage} viewPos={bubbleViewPos} />
      )}
    </>
  );
};
