"use client";

import { useState, Suspense, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line, Text } from "@react-three/drei";
import React from "react";
import * as THREE from "three";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeasurementArrow } from "@/components/MeasurementArrow";

/** Default values matching typical report data */
const DEFAULTS = {
	address: "281 Clermont Ave, Brooklyn, NY 11205",
	// Lot: Front 25, Back 25, Left 100, Right 100 → width 25, length 100
	lotLengthFt: 100,
	lotWidthFt: 25,
	scale: 0.1,
	groundColor: "#E5E7EB",
	containerHeightPx: 400,
	lotSlabHeightFt: 2,
	lotSlabPaddingFt: 2,
	ambientLightIntensity: 0.6,
	directionalLightIntensity: 0.8,
	// Initial camera: orbited toward left, tilted higher to see roof
	cameraPosX: -5,
	cameraPosY: 6,
	cameraPosZ: -10,
	// Building (block) defaults: Front 20, Back 20, Left 80, Right 80; heights and setback
	frontWallFt: 20,
	backWallFt: 20,
	leftWallFt: 80,
	rightWallFt: 80,
	baseHeightFt: 20,
	buildingHeightFt: 37,
	setbackStartFt: 18,
	frontSetbackFt: 20, // Upper story setback (ft)
	xAlign: "center" as const,
	zAlign: "center" as const,
};

/** Renders a line that can be solid or dashed; points are [x,y,z] tuples */
function DimensionLine({
	points,
	color,
	lineWidth = 2,
	dashed = false,
}: {
	points: [number, number, number][];
	color: string;
	lineWidth?: number;
	dashed?: boolean;
}) {
	const lineRef = useRef<THREE.Line>(null);
	const positions = useMemo(() => {
		const arr: number[] = [];
		for (const p of points) arr.push(p[0], p[1], p[2]);
		return new Float32Array(arr);
	}, [points]);
	useLayoutEffect(() => {
		if (!dashed || !lineRef.current) return;
		lineRef.current.computeLineDistances();
	}, [dashed, points]);
	if (points.length < 2) return null;
	if (dashed) {
		return (
			<line ref={lineRef as unknown as React.LegacyRef<SVGLineElement>}>
				<bufferGeometry>
					<bufferAttribute
						attach="attributes-position"
						count={positions.length / 3}
						array={positions}
						itemSize={3}
					/>
				</bufferGeometry>
				<lineDashedMaterial
					color={color}
					dashSize={0.5}
					gapSize={0.25}
				/>
			</line>
		);
	}
	return (
		<Line
			points={points}
			color={color}
			lineWidth={lineWidth}
		/>
	);
}

/** Renders a dimension line with arrows at both ends and a label in the middle */
function DimensionLineWithLabel({
	start,
	end,
	label,
	color = "#37322F",
	lineWidth = 2,
	labelOffset = 0.3,
}: {
	start: [number, number, number];
	end: [number, number, number];
	label: string;
	color?: string;
	lineWidth?: number;
	labelOffset?: number;
}) {
	const midpoint = useMemo(() => {
		return [
			(start[0] + end[0]) / 2,
			(start[1] + end[1]) / 2 + labelOffset,
			(start[2] + end[2]) / 2,
		] as [number, number, number];
	}, [start, end, labelOffset]);
	const direction = useMemo(() => {
		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const dz = end[2] - start[2];
		const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
		if (len === 0) return { x: 0, y: 0, z: 0, len: 0 };
		return { x: dx / len, y: dy / len, z: dz / len, len };
	}, [start, end]);
	const arrowSize = 0.2;
	const arrowAngle = Math.PI / 6;
	const arrowLength = arrowSize * 0.5;
	const arrow1Points = useMemo(() => {
		if (direction.len === 0) return null;
		const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
		const up = Math.abs(direction.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
		const right = new THREE.Vector3().crossVectors(dir, up).normalize();
		const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
		const arrowTip = new THREE.Vector3(...start);
		const arrowBase1 = arrowTip.clone().add(dir.clone().multiplyScalar(arrowSize)).add(right.clone().multiplyScalar(arrowLength));
		const arrowBase2 = arrowTip.clone().add(dir.clone().multiplyScalar(arrowSize)).sub(right.clone().multiplyScalar(arrowLength));
		return [
			[arrowTip.x, arrowTip.y, arrowTip.z],
			[arrowBase1.x, arrowBase1.y, arrowBase1.z],
			[arrowTip.x, arrowTip.y, arrowTip.z],
			[arrowBase2.x, arrowBase2.y, arrowBase2.z],
		] as [number, number, number][];
	}, [start, direction, arrowSize, arrowLength]);
	const arrow2Points = useMemo(() => {
		if (direction.len === 0) return null;
		const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
		const up = Math.abs(direction.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
		const right = new THREE.Vector3().crossVectors(dir, up).normalize();
		const arrowTip = new THREE.Vector3(...end);
		const arrowBase1 = arrowTip.clone().sub(dir.clone().multiplyScalar(arrowSize)).add(right.clone().multiplyScalar(arrowLength));
		const arrowBase2 = arrowTip.clone().sub(dir.clone().multiplyScalar(arrowSize)).sub(right.clone().multiplyScalar(arrowLength));
		return [
			[arrowTip.x, arrowTip.y, arrowTip.z],
			[arrowBase1.x, arrowBase1.y, arrowBase1.z],
			[arrowTip.x, arrowTip.y, arrowTip.z],
			[arrowBase2.x, arrowBase2.y, arrowBase2.z],
		] as [number, number, number][];
	}, [end, direction, arrowSize, arrowLength]);
	return (
		<>
			<Line points={[start, end]} color={color} lineWidth={lineWidth} />
			{arrow1Points && <Line points={arrow1Points} color={color} lineWidth={lineWidth} />}
			{arrow2Points && <Line points={arrow2Points} color={color} lineWidth={lineWidth} />}
			<CameraAwareLabel position={midpoint} center>
				<div className="bg-white/92 backdrop-blur-sm rounded px-1 py-0.5 text-[9px] font-medium text-[#37322F] border border-[rgba(55,50,47,0.12)] shadow-sm whitespace-nowrap">
					{label}
				</div>
			</CameraAwareLabel>
		</>
	);
}

/** Html label that only shows when its position is in front of the camera */
function CameraAwareLabel({
	position,
	children,
	...props
}: {
	position: [number, number, number];
	children: React.ReactNode;
	[key: string]: any;
}) {
	const { camera } = useThree();
	const [visible, setVisible] = useState(true);
	const labelPos = useMemo(() => new THREE.Vector3(...position), [position]);
	useEffect(() => {
		const checkVisibility = () => {
			const cameraPos = new THREE.Vector3();
			camera.getWorldPosition(cameraPos);
			const cameraForward = new THREE.Vector3();
			camera.getWorldDirection(cameraForward);
			const toLabel = labelPos.clone().sub(cameraPos);
			const toLabelNormalized = toLabel.normalize();
			const dot = cameraForward.dot(toLabelNormalized);
			// Show if label is in front of camera (dot > 0 means forward-facing)
			setVisible(dot > -0.3); // -0.3 threshold to hide when mostly behind
		};
		checkVisibility();
		const interval = setInterval(checkVisibility, 100);
		return () => clearInterval(interval);
	}, [camera, labelPos]);
	if (!visible) return null;
	return <Html position={position} {...props}>{children}</Html>;
}

const SHOW_THRESHOLD = 0.35;
const HIDE_THRESHOLD = 0.2;

/** Lot dimension label visibility: show/hide with hysteresis to avoid flicker */
const LOT_LABEL_SHOW_THRESHOLD = 0.4;
const LOT_LABEL_HIDE_THRESHOLD = 0.3;

/** Building measurement arrow visibility: camera-facing with hysteresis */
const ARROW_SHOW_THRESHOLD = 0.45;
const ARROW_HIDE_THRESHOLD = 0.25;

const labelStyle = "bg-white/92 backdrop-blur-sm rounded px-1 py-0.5 text-[8px] font-medium text-[#37322F] border border-[rgba(55,50,47,0.12)] shadow-sm whitespace-nowrap";

/** Building side labels: show only when camera is on that side of the block (with hysteresis) */
function BuildingSideLabels({
	positions,
}: {
	positions: { front: [number, number, number]; back: [number, number, number]; left: [number, number, number]; right: [number, number, number] };
}) {
	const { camera } = useThree();
	const center = useMemo(() => new THREE.Vector3(0, 0, 0), []);
	const dir = useRef(new THREE.Vector3());
	const camPos = useRef(new THREE.Vector3());
	const [visible, setVisible] = useState({ front: true, back: true, left: true, right: true });
	const prevVisible = useRef({ front: true, back: true, left: true, right: true });

	useFrame(() => {
		camera.getWorldPosition(camPos.current);
		dir.current.copy(camPos.current).sub(center).normalize();
		const dx = dir.current.x;
		const dz = dir.current.z;

		const frontDot = -dz; // front = -Z, show when camera in -Z direction
		const backDot = dz;
		const rightDot = dx;
		const leftDot = -dx;

		const next = {
			front: prevVisible.current.front ? frontDot > HIDE_THRESHOLD : frontDot > SHOW_THRESHOLD,
			back: prevVisible.current.back ? backDot > HIDE_THRESHOLD : backDot > SHOW_THRESHOLD,
			left: prevVisible.current.left ? rightDot > HIDE_THRESHOLD : rightDot > SHOW_THRESHOLD,
			right: prevVisible.current.right ? leftDot > HIDE_THRESHOLD : leftDot > SHOW_THRESHOLD,
		};
		const changed =
			next.front !== prevVisible.current.front ||
			next.back !== prevVisible.current.back ||
			next.left !== prevVisible.current.left ||
			next.right !== prevVisible.current.right;
		prevVisible.current = next;
		if (changed) setVisible({ ...next });
	});

	return (
		<>
			{visible.front && (
				<Html position={positions.front} center>
					<div className={labelStyle}>Front</div>
				</Html>
			)}
			{visible.back && (
				<Html position={positions.back} center>
					<div className={labelStyle}>Back</div>
				</Html>
			)}
			{visible.right && (
				<Html position={positions.right} center>
					<div className={labelStyle}>Right</div>
				</Html>
			)}
			{visible.left && (
				<Html position={positions.left} center>
					<div className={labelStyle}>Left</div>
				</Html>
			)}
		</>
	);
}

const HEIGHT_TICK_SPACING_FT = 10;
const RULER_OFFSET_WORLD = 0.6; // offset left of building (world units)
const TICK_LENGTH = 0.15; // scene units; tick sticks out left from pole
const TICK_LENGTH_MAJOR = 0.3; // major tick (e.g. base height) — 2x normal
const CAP_LENGTH = 0.2; // scene units; end cap half-length each side of pole
const HEIGHT_MARKER_LINEWIDTH = 2;
const HEIGHT_MARKER_COLOR = "#000000";
const HEIGHT_LABEL_OFFSET = 1.5; // world units left of pole (space between pole and text)
const BASE_LABEL_OFFSET = 1.5; // world units left of pole for "Base X ft" label (further out so not touching pole)
const BASE_TICK_EPSILON_FT = 0.5; // treat tick as "at base" if within this many ft

type LineSeg = { p1: [number, number, number]; p2: [number, number, number] };

/**
 * Height dimension marker: black vertical pole at back-left edge with end caps, ticks every 10 ft,
 * optional major tick + label at base height, and total height label.
 * Anchor from footprint "bbox": x = min.x - offset, z = max.z (back), y = 0.
 */
function useHeightDimensionMarker(
	bboxMinX: number,
	bboxMinZ: number,
	bboxMaxZ: number,
	buildingHeightFt: number,
	scale: number,
	baseHeightFt?: number
): {
	mainLine: LineSeg;
	bottomCap: LineSeg;
	topCap: LineSeg;
	ticks: LineSeg[];
	labelPosition: [number, number, number];
	heightWorld: number;
	baseTick: LineSeg | null;
	baseLabelPosition: [number, number, number] | null;
	baseLabelText: string;
} {
	return useMemo(() => {
		const heightWorld = buildingHeightFt * scale;
		const anchorX = bboxMinX - RULER_OFFSET_WORLD;
		const anchorZ = bboxMaxZ;
		const anchorY0 = 0;

		const mainLine: LineSeg = {
			p1: [anchorX, anchorY0, anchorZ],
			p2: [anchorX, heightWorld, anchorZ],
		};
		const bottomCap: LineSeg = {
			p1: [anchorX - CAP_LENGTH / 2, anchorY0, anchorZ],
			p2: [anchorX + CAP_LENGTH / 2, anchorY0, anchorZ],
		};
		const topCap: LineSeg = {
			p1: [anchorX - CAP_LENGTH / 2, heightWorld, anchorZ],
			p2: [anchorX + CAP_LENGTH / 2, heightWorld, anchorZ],
		};

		const showBase = baseHeightFt != null && baseHeightFt > 0 && baseHeightFt < buildingHeightFt;
		const baseHeightWorld = showBase ? baseHeightFt * scale : 0;

		const ticks: LineSeg[] = [];
		for (let i = HEIGHT_TICK_SPACING_FT; i < buildingHeightFt; i += HEIGHT_TICK_SPACING_FT) {
			const isAtBase = showBase && Math.abs(i - baseHeightFt) < BASE_TICK_EPSILON_FT;
			if (isAtBase) continue; // draw as major tick instead
			const yWorld = i * scale;
			ticks.push(
				{ p1: [anchorX, yWorld, anchorZ], p2: [anchorX - TICK_LENGTH, yWorld, anchorZ] }
			);
		}

		const baseTick: LineSeg | null = showBase
			? { p1: [anchorX, baseHeightWorld, anchorZ], p2: [anchorX - TICK_LENGTH_MAJOR, baseHeightWorld, anchorZ] }
			: null;
		const baseLabelPosition: [number, number, number] | null = showBase
			? [anchorX - BASE_LABEL_OFFSET, baseHeightWorld, anchorZ]
			: null;
		const baseLabelText = showBase ? `Base height: ${baseHeightFt} ft` : "";

		const labelPosition: [number, number, number] = [
			anchorX - HEIGHT_LABEL_OFFSET,
			heightWorld,
			anchorZ,
		];
		return {
			mainLine,
			bottomCap,
			topCap,
			ticks,
			labelPosition,
			heightWorld,
			baseTick,
			baseLabelPosition,
			baseLabelText,
		};
	}, [bboxMinX, bboxMinZ, bboxMaxZ, buildingHeightFt, scale, baseHeightFt]);
}

/** 3D scene driven by sandbox state */
function MassingSandboxScene({
	lotLengthFt,
	lotWidthFt,
	scale,
	groundColor,
	lotSlabHeightFt = 2,
	lotSlabPaddingFt = 2,
	ambientLightIntensity = 0.6,
	directionalLightIntensity = 0.8,
	frontWallFt = 20,
	backWallFt = 20,
	leftWallFt = 80,
	rightWallFt = 80,
	baseHeightFt = 10,
	buildingHeightFt = 10,
	setbackStartFt = 10,
	frontSetbackFt = 0,
	xAlign,
	zAlign,
}: {
	lotLengthFt: number;
	lotWidthFt: number;
	scale: number;
	groundColor: string;
	lotSlabHeightFt?: number;
	lotSlabPaddingFt?: number;
	ambientLightIntensity?: number;
	directionalLightIntensity?: number;
	frontWallFt?: number;
	backWallFt?: number;
	leftWallFt?: number;
	rightWallFt?: number;
	baseHeightFt?: number;
	buildingHeightFt?: number;
	setbackStartFt?: number;
	/** Front story setback (ft) */
	frontSetbackFt?: number;
	xAlign?: "left" | "center" | "right";
	zAlign?: "front" | "center" | "back";
}) {
	const lotLength = lotLengthFt * scale;
	const lotWidth = lotWidthFt * scale;
	const centerX = 0;
	const centerZ = 0;
	const slabPadding = (lotSlabPaddingFt ?? 0) * scale;
	const slabLength = lotLength + slabPadding * 2;
	const slabWidth = lotWidth + slabPadding * 2;
	const slabHeight = (lotSlabHeightFt ?? 2) * scale;

	// Building footprint: independent edges; vertices then offset so footprint is centered on the lot.
	const anchorX = centerX - lotWidth / 2;
	const anchorZ = centerZ - lotLength / 2;
	const front = frontWallFt * scale;
	const back = backWallFt * scale;
	const left = leftWallFt * scale;
	const right = rightWallFt * scale;
	const buildingHeightTotal = (buildingHeightFt ?? 10) * scale;
	const setbackStartWorld = (setbackStartFt ?? baseHeightFt ?? 10) * scale;
	const maxDepthWorld = Math.max(left, right);
	const frontSetbackClamped = Math.min(Math.max(frontSetbackFt ?? 0, 0), maxDepthWorld / scale - 0.01);
	const frontSetbackWorld = frontSetbackClamped * scale;
	// Upper story setback (ft) controls: only the FRONT edge of the upper footprint. The upper mass
	// front face is offset inward (+Z) by frontSetbackWorld from the base mass front face. Base mass
	// height = setbackStartWorld (baseHeight); upper mass sits above that. No other edges/sides are offset.

	// Centroid of quad (frontLeft, frontRight, backRight, backLeft) so we can center the shape
	const footprintCenterX = anchorX + (front + back) / 4;
	const footprintCenterZ = anchorZ + (left + right) / 4;
	const offsetX = centerX - footprintCenterX;
	const offsetZ = centerZ - footprintCenterZ;

	// Building placement inside lot: axis-aligned bounds and clamped position
	const buildingWidth = Math.max(front, back);
	const buildingDepth = Math.max(left, right);
	const halfLotW = lotWidth / 2;
	const halfLotD = lotLength / 2;
	const halfBuildingW = buildingWidth / 2;
	const halfBuildingD = buildingDepth / 2;
	const minX = -halfLotW + halfBuildingW;
	const maxX = halfLotW - halfBuildingW;
	const minZ = -halfLotD + halfBuildingD;
	const maxZ = halfLotD - halfBuildingD;
	const alignX = xAlign ?? "center";
	const alignZ = zAlign ?? "center";
	const rawX = alignX === "left" ? minX : alignX === "right" ? maxX : 0;
	const rawZ = alignZ === "front" ? minZ : alignZ === "back" ? maxZ : 0;
	const buildingPosX = Math.min(Math.max(rawX, minX), maxX);
	const buildingPosZ = Math.min(Math.max(rawZ, minZ), maxZ);
	const buildingPosition = useMemo(
		() => [buildingPosX, 0, buildingPosZ] as [number, number, number],
		[buildingPosX, buildingPosZ]
	);

	// Building footprint edges for measurement arrows (group local space, Y = 10 ft)
	const measurementHeightY = 10 * scale;
	const pFrontLeft = useMemo(() => [anchorX + offsetX, measurementHeightY, anchorZ + offsetZ] as [number, number, number], [anchorX, offsetX, anchorZ, offsetZ, measurementHeightY]);
	const pFrontRight = useMemo(() => [anchorX + front + offsetX, measurementHeightY, anchorZ + offsetZ] as [number, number, number], [anchorX, front, offsetX, anchorZ, offsetZ, measurementHeightY]);
	const pBackLeft = useMemo(() => [anchorX + offsetX, measurementHeightY, anchorZ + offsetZ + right] as [number, number, number], [anchorX, offsetX, anchorZ, offsetZ, right, measurementHeightY]);
	const pBackRight = useMemo(() => [anchorX + back + offsetX, measurementHeightY, anchorZ + offsetZ + left] as [number, number, number], [anchorX, back, offsetX, anchorZ, offsetZ, left, measurementHeightY]);

	const measurementEdges = useMemo(
		() => ({
			front: { start: pFrontLeft, end: pFrontRight, label: `Front: ${frontWallFt} ft`, labelOffsetDirection: [0, 0, -1] as [number, number, number] },
			back: { start: pBackLeft, end: pBackRight, label: `Back: ${backWallFt} ft`, labelOffsetDirection: [0, 0, 1] as [number, number, number] },
			left: { start: pFrontLeft, end: pBackLeft, label: `Right: ${rightWallFt} ft`, labelOffsetDirection: [-1, 0, 0] as [number, number, number] },
			right: { start: pFrontRight, end: pBackRight, label: `Left: ${leftWallFt} ft`, labelOffsetDirection: [1, 0, 0] as [number, number, number] },
		}),
		[pFrontLeft, pFrontRight, pBackLeft, pBackRight, frontWallFt, backWallFt, leftWallFt, rightWallFt]
	);

	// Upper story setback arrow: horizontal distance from base front face to upper front face (ground plane, building group local)
	const GROUND_Y = 0.05;
	const baseFrontMid = useMemo(
		() => [anchorX + offsetX + front / 2, GROUND_Y, anchorZ + offsetZ] as [number, number, number],
		[anchorX, offsetX, anchorZ, offsetZ, front]
	);
	const upperFrontMid = useMemo(
		() => [anchorX + offsetX + front / 2, GROUND_Y, anchorZ + offsetZ + frontSetbackWorld] as [number, number, number],
		[anchorX, offsetX, anchorZ, offsetZ, front, frontSetbackWorld]
	);
	const upperSetbackLabel = useMemo(
		() => `Upper setback: ${frontSetbackClamped} ft`,
		[frontSetbackClamped]
	);

	// Full footprint (base mass)
	const footprintShape = useMemo(() => {
		const s = new THREE.Shape();
		// Shape is in XY; we use (world X, -world Z) so after rotation -π/2 around X (local Z→world Y) we get world Z correct
		// Counterclockwise: frontLeft -> frontRight -> backRight -> backLeft
		s.moveTo(anchorX + offsetX, -(anchorZ + offsetZ));
		s.lineTo(anchorX + front + offsetX, -(anchorZ + offsetZ));
		s.lineTo(anchorX + back + offsetX, -(anchorZ + left + offsetZ));
		s.lineTo(anchorX + offsetX, -(anchorZ + right + offsetZ));
		s.lineTo(anchorX + offsetX, -(anchorZ + offsetZ));
		return s;
	}, [anchorX, anchorZ, front, back, left, right, offsetX, offsetZ]);

	// Upper footprint: only the front edge is moved inward by upper story setback (frontSetbackWorld); back/left/right unchanged
	const upperFootprintShape = useMemo(() => {
		const s = new THREE.Shape();
		const frontZ = anchorZ + offsetZ + frontSetbackWorld;
		s.moveTo(anchorX + offsetX, -frontZ);
		s.lineTo(anchorX + front + offsetX, -frontZ);
		s.lineTo(anchorX + back + offsetX, -(anchorZ + left + offsetZ));
		s.lineTo(anchorX + offsetX, -(anchorZ + right + offsetZ));
		s.lineTo(anchorX + offsetX, -frontZ);
		return s;
	}, [anchorX, anchorZ, front, back, left, right, offsetX, offsetZ, frontSetbackWorld]);

	const oneMass = (buildingHeightFt ?? 10) <= (baseHeightFt ?? 10);
	const massHeightA = oneMass ? buildingHeightTotal : setbackStartWorld;
	const massHeightB = oneMass ? 0 : buildingHeightTotal - setbackStartWorld;

	const buildingGeometryA = useMemo(() => {
		return new THREE.ExtrudeGeometry(footprintShape, {
			depth: massHeightA,
			bevelEnabled: false,
		});
	}, [footprintShape, massHeightA]);

	const buildingGeometryB = useMemo(() => {
		if (massHeightB <= 0) return null;
		return new THREE.ExtrudeGeometry(upperFootprintShape, {
			depth: massHeightB,
			bevelEnabled: false,
		});
	}, [upperFootprintShape, massHeightB]);

	useEffect(() => {
		return () => {
			buildingGeometryA.dispose();
			buildingGeometryB?.dispose();
		};
	}, [buildingGeometryA, buildingGeometryB]);

	// Height dimension marker: total building height, anchor at front-left edge of footprint
	const bboxMinX = anchorX + offsetX;
	const bboxMinZ = anchorZ + offsetZ;
	const bboxMaxZ = anchorZ + offsetZ + Math.max(left, right);
	const totalHeightFt = buildingHeightFt ?? 10;
	const baseHeightFtVal = baseHeightFt ?? 10;
	const heightMarker = useHeightDimensionMarker(
		bboxMinX,
		bboxMinZ,
		bboxMaxZ,
		totalHeightFt,
		scale,
		baseHeightFtVal
	);

	// Lot dimension label visibility: camera-facing (length = left/right sides, width = front/back sides), with hysteresis
	const { camera } = useThree();
	const lotCenter = useMemo(() => new THREE.Vector3(centerX, 0, centerZ), [centerX, centerZ]);
	const buildingCenterVec = useMemo(() => new THREE.Vector3(buildingPosX, 0, buildingPosZ), [buildingPosX, buildingPosZ]);
	const camDir = useRef(new THREE.Vector3());
	const camPos = useRef(new THREE.Vector3());
	const camDirBuilding = useRef(new THREE.Vector3());
	const [lotLengthLabelVisible, setLotLengthLabelVisible] = useState(true);
	const [lotWidthLabelVisible, setLotWidthLabelVisible] = useState(true);
	const prevLengthVisible = useRef(true);
	const prevWidthVisible = useRef(true);
	const [arrowVisible, setArrowVisible] = useState({ front: true, back: true, left: true, right: true });
	const prevArrowVisible = useRef({ front: true, back: true, left: true, right: true });

	useFrame(() => {
		camera.getWorldPosition(camPos.current);
		camDir.current.copy(camPos.current).sub(lotCenter).normalize();
		const dx = camDir.current.x;
		const dz = camDir.current.z;
		// Length sides: LEFT (-1,0,0) and RIGHT (1,0,0) → visible when |dx| large
		const lengthDot = Math.max(-dx, dx);
		// Width sides: FRONT (0,0,-1) and BACK (0,0,1) → visible when |dz| large
		const widthDot = Math.max(-dz, dz);
		const nextLength = prevLengthVisible.current ? lengthDot > LOT_LABEL_HIDE_THRESHOLD : lengthDot > LOT_LABEL_SHOW_THRESHOLD;
		const nextWidth = prevWidthVisible.current ? widthDot > LOT_LABEL_HIDE_THRESHOLD : widthDot > LOT_LABEL_SHOW_THRESHOLD;
		const changedLength = nextLength !== prevLengthVisible.current;
		const changedWidth = nextWidth !== prevWidthVisible.current;
		prevLengthVisible.current = nextLength;
		prevWidthVisible.current = nextWidth;
		if (changedLength) setLotLengthLabelVisible(nextLength);
		if (changedWidth) setLotWidthLabelVisible(nextWidth);

		// Building measurement arrow visibility: camera-facing each side, hysteresis to avoid flicker
		camDirBuilding.current.copy(camPos.current).sub(buildingCenterVec).normalize();
		const bx = camDirBuilding.current.x;
		const bz = camDirBuilding.current.z;
		const frontDot = -bz;
		const backDot = bz;
		const leftDot = -bx;
		const rightDot = bx;
		const nextFront = prevArrowVisible.current.front ? frontDot > ARROW_HIDE_THRESHOLD : frontDot > ARROW_SHOW_THRESHOLD;
		const nextBack = prevArrowVisible.current.back ? backDot > ARROW_HIDE_THRESHOLD : backDot > ARROW_SHOW_THRESHOLD;
		const nextLeft = prevArrowVisible.current.left ? leftDot > ARROW_HIDE_THRESHOLD : leftDot > ARROW_SHOW_THRESHOLD;
		const nextRight = prevArrowVisible.current.right ? rightDot > ARROW_HIDE_THRESHOLD : rightDot > ARROW_SHOW_THRESHOLD;
		const nextArrow = { front: nextFront, back: nextBack, left: nextLeft, right: nextRight };
		const arrowChanged =
			nextArrow.front !== prevArrowVisible.current.front ||
			nextArrow.back !== prevArrowVisible.current.back ||
			nextArrow.left !== prevArrowVisible.current.left ||
			nextArrow.right !== prevArrowVisible.current.right;
		prevArrowVisible.current = nextArrow;
		if (arrowChanged) setArrowVisible({ ...nextArrow });
	});

	return (
		<>
			<ambientLight intensity={ambientLightIntensity} />
			<directionalLight position={[10, 10, 5]} intensity={directionalLightIntensity} />
			<directionalLight position={[-10, 5, -5]} intensity={directionalLightIntensity * 0.5} />

			{/* Gray lot slab */}
			<mesh position={[centerX, -slabHeight / 2, centerZ]}>
				<boxGeometry args={[slabWidth, slabHeight, slabLength]} />
				<meshStandardMaterial color={groundColor} />
			</mesh>

			{/* Building group: placement inside lot (clamped by alignment) */}
			<group position={buildingPosition}>
				{/* Base mass: full footprint, height = setbackStart (or full height if one mass) */}
				<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
					<primitive object={buildingGeometryA} attach="geometry" />
					<meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.4} />
				</mesh>
				{/* Upper mass (tower): front story setback footprint, stacked above base */}
				{buildingGeometryB && (
					<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, setbackStartWorld, 0]}>
						<primitive object={buildingGeometryB} attach="geometry" />
						<meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.4} />
					</mesh>
				)}

				{/* Building side labels: visible only when camera is on that side (with hysteresis) */}
				<BuildingSideLabels
					positions={{
						front: [anchorX + offsetX + front / 2, 0.05, anchorZ + offsetZ],
						back: [anchorX + offsetX + back / 2, buildingHeightTotal / 2 + 0.05, anchorZ + offsetZ + (left + right) / 2],
						left: [anchorX + offsetX + (front + back) / 2, -slabHeight + 0.1, anchorZ + offsetZ + left / 2],
						right: [anchorX + offsetX, -slabHeight + 0.1, anchorZ + offsetZ + right / 2],
					}}
				/>

				{/* Measurement arrows: Front/Back/Left/Right, visible only when camera faces that side */}
				{arrowVisible.front && (
					<MeasurementArrow
						start={measurementEdges.front.start}
						end={measurementEdges.front.end}
						label={measurementEdges.front.label}
						labelOffsetDirection={measurementEdges.front.labelOffsetDirection}
					/>
				)}
				{arrowVisible.back && (
					<MeasurementArrow
						start={measurementEdges.back.start}
						end={measurementEdges.back.end}
						label={measurementEdges.back.label}
						labelOffsetDirection={measurementEdges.back.labelOffsetDirection}
					/>
				)}
				{arrowVisible.left && (
					<MeasurementArrow
						start={measurementEdges.left.start}
						end={measurementEdges.left.end}
						label={measurementEdges.left.label}
						labelOffsetDirection={measurementEdges.left.labelOffsetDirection}
					/>
				)}
				{arrowVisible.right && (
					<MeasurementArrow
						start={measurementEdges.right.start}
						end={measurementEdges.right.end}
						label={measurementEdges.right.label}
						labelOffsetDirection={measurementEdges.right.labelOffsetDirection}
					/>
				)}

				{/* Upper story setback arrow: base front face → upper front face, horizontal on ground; label at Setback height */}
				{arrowVisible.front && frontSetbackWorld > 0.01 && (
					<MeasurementArrow
						start={baseFrontMid}
						end={upperFrontMid}
						label={upperSetbackLabel}
						labelOffsetDirection={[0, 0, -1]}
						labelY={setbackStartWorld}
					/>
				)}

				{/* Height dimension marker: black pole at back-left edge with end caps, ticks every 10 ft, base + total labels */}
				<group>
					<Line points={[heightMarker.mainLine.p1, heightMarker.mainLine.p2]} color={HEIGHT_MARKER_COLOR} lineWidth={HEIGHT_MARKER_LINEWIDTH} />
					<Line points={[heightMarker.bottomCap.p1, heightMarker.bottomCap.p2]} color={HEIGHT_MARKER_COLOR} lineWidth={HEIGHT_MARKER_LINEWIDTH} />
					<Line points={[heightMarker.topCap.p1, heightMarker.topCap.p2]} color={HEIGHT_MARKER_COLOR} lineWidth={HEIGHT_MARKER_LINEWIDTH} />
					{heightMarker.ticks.map((tick, i) => (
						<Line key={i} points={[tick.p1, tick.p2]} color={HEIGHT_MARKER_COLOR} lineWidth={HEIGHT_MARKER_LINEWIDTH} />
					))}
					{heightMarker.baseTick != null && (
						<Line points={[heightMarker.baseTick.p1, heightMarker.baseTick.p2]} color={HEIGHT_MARKER_COLOR} lineWidth={HEIGHT_MARKER_LINEWIDTH} />
					)}
					{heightMarker.baseLabelPosition != null && (
						<Text
							position={heightMarker.baseLabelPosition}
							anchorX="center"
							anchorY="middle"
							fontSize={0.22}
							color={HEIGHT_MARKER_COLOR}
							scale={[-1, 1, 1]}
						>
							{heightMarker.baseLabelText}
						</Text>
					)}
					<Text
						position={heightMarker.labelPosition}
						anchorX="center"
						anchorY="middle"
						fontSize={0.22}
						color={HEIGHT_MARKER_COLOR}
						scale={[-1, 1, 1]}
					>
						 Building height: {totalHeightFt} ft
					</Text>
				</group>
			</group>

			{/* Lot length dimension line - front to back along Z, positioned on left edge; visible when camera faces length (left/right) side */}
			{lotLengthLabelVisible && (
				<DimensionLineWithLabel
					start={[centerX - lotWidth / 2, 0.1, centerZ - lotLength / 2]}
					end={[centerX - lotWidth / 2, 0.1, centerZ + lotLength / 2]}
					label={`Lot length: ${lotLengthFt} ft`}
					color="#37322F"
					lineWidth={2}
					labelOffset={0.2}
				/>
			)}
			{/* Lot width dimension line - left to right along X, positioned on front edge; visible when camera faces width (front/back) side */}
			{lotWidthLabelVisible && (
				<DimensionLineWithLabel
					start={[centerX - lotWidth / 2, 0.1, centerZ - lotLength / 2]}
					end={[centerX + lotWidth / 2, 0.1, centerZ - lotLength / 2]}
					label={`Lot width: ${lotWidthFt} ft`}
					color="#37322F"
					lineWidth={2}
					labelOffset={0.2}
				/>
			)}

			<OrbitControls
				enablePan
				enableZoom
				enableRotate
				minDistance={Math.max(lotWidth, lotLength) * 0.3}
				maxDistance={Math.max(lotWidth, lotLength) * 5}
				target={[centerX, 0, centerZ]}
			/>
		</>
	);
}

function parseNum(value: string, fallback: number): number {
	const n = parseFloat(value);
	return Number.isFinite(n) ? n : fallback;
}

export default function MassingSandboxPage() {
	const [address, setAddress] = useState(DEFAULTS.address);
	const [lotLengthFt, setLotLengthFt] = useState(String(DEFAULTS.lotLengthFt));
	const [lotWidthFt, setLotWidthFt] = useState(String(DEFAULTS.lotWidthFt));
	const [frontWallFt, setFrontWallFt] = useState(String(DEFAULTS.frontWallFt));
	const [backWallFt, setBackWallFt] = useState(String(DEFAULTS.backWallFt));
	const [leftWallFt, setLeftWallFt] = useState(String(DEFAULTS.leftWallFt));
	const [rightWallFt, setRightWallFt] = useState(String(DEFAULTS.rightWallFt));
	const [baseHeightFt, setBaseHeightFt] = useState(String(DEFAULTS.baseHeightFt));
	const [buildingHeightFt, setBuildingHeightFt] = useState(String(DEFAULTS.buildingHeightFt));
	const [setbackStartFt, setSetbackStartFt] = useState(String(DEFAULTS.setbackStartFt));
	const [frontSetbackFt, setFrontSetbackFt] = useState(String(DEFAULTS.frontSetbackFt));
	const [xAlign, setXAlign] = useState<"left" | "center" | "right">(DEFAULTS.xAlign);
	const [zAlign, setZAlign] = useState<"front" | "center" | "back">(DEFAULTS.zAlign);

	const lotL = parseNum(lotLengthFt, DEFAULTS.lotLengthFt);
	const lotW = parseNum(lotWidthFt, DEFAULTS.lotWidthFt);
	const s = DEFAULTS.scale;
	const heightPx = DEFAULTS.containerHeightPx;
	const valid = lotL > 0 && lotW > 0 && s > 0;
	const frontW = parseNum(frontWallFt, DEFAULTS.frontWallFt);
	const backW = parseNum(backWallFt, DEFAULTS.backWallFt);
	const leftW = parseNum(leftWallFt, DEFAULTS.leftWallFt);
	const rightW = parseNum(rightWallFt, DEFAULTS.rightWallFt);
	const baseH = parseNum(baseHeightFt, DEFAULTS.baseHeightFt);
	const buildingH = parseNum(buildingHeightFt, DEFAULTS.buildingHeightFt);
	const setbackStart = parseNum(setbackStartFt, DEFAULTS.setbackStartFt);
	const frontSetback = parseNum(frontSetbackFt, DEFAULTS.frontSetbackFt);

	const resetToDefaults = () => {
		setLotLengthFt(String(DEFAULTS.lotLengthFt));
		setLotWidthFt(String(DEFAULTS.lotWidthFt));
	};

	const camX = DEFAULTS.cameraPosX;
	const camY = DEFAULTS.cameraPosY;
	const camZ = DEFAULTS.cameraPosZ;

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			<p className="text-sm text-[#605A57]">
				Adjust inputs below to preview how the 3D massing will look. No backend — changes apply instantly. When you&apos;re happy with the look, we can mirror these settings on the report view.
			</p>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Controls */}
				<Card className="lg:col-span-1">
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Massing inputs</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="address">Address</Label>
							<Input
								id="address"
								type="text"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								placeholder="e.g. 281 Clermont Ave, Brooklyn, NY 11205"
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="lotLength">Lot length (ft)</Label>
								<Input
									id="lotLength"
									type="number"
									min={1}
									value={lotLengthFt}
									onChange={(e) => setLotLengthFt(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="lotWidth">Lot width (ft)</Label>
								<Input
									id="lotWidth"
									type="number"
									min={1}
									value={lotWidthFt}
									onChange={(e) => setLotWidthFt(e.target.value)}
								/>
							</div>
						</div>
						<div className="space-y-2 rounded-lg border border-[rgba(55,50,47,0.12)] p-3 bg-white">
							<Label className="text-xs font-semibold text-[#605A57]">Building placement inside lot</Label>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<Label htmlFor="xAlign" className="text-xs">Left vs Right</Label>
									<Select value={xAlign} onValueChange={(v) => setXAlign(v as "left" | "center" | "right")}>
										<SelectTrigger id="xAlign" className="h-8 w-full">
											<SelectValue placeholder="X" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="left">Left</SelectItem>
											<SelectItem value="center">Center</SelectItem>
											<SelectItem value="right">Right</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="zAlign" className="text-xs">Front vs Back</Label>
									<Select value={zAlign} onValueChange={(v) => setZAlign(v as "front" | "center" | "back")}>
										<SelectTrigger id="zAlign" className="h-8 w-full">
											<SelectValue placeholder="Z" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="front">Front</SelectItem>
											<SelectItem value="center">Center</SelectItem>
											<SelectItem value="back">Back</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
						<div className="space-y-2 rounded-lg border border-[rgba(55,50,47,0.12)] p-3 bg-white">
							<Label className="text-xs font-semibold text-[#605A57]">Building walls (ft) — each edge moves independently</Label>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<Label htmlFor="frontWall" className="text-xs">Front (Width)</Label>
									<Input id="frontWall" type="number" min={0} value={frontWallFt} onChange={(e) => setFrontWallFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="backWall" className="text-xs">Back (Width)</Label>
									<Input id="backWall" type="number" min={0} value={backWallFt} onChange={(e) => setBackWallFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="leftWall" className="text-xs">Left (Length)</Label>
									<Input id="leftWall" type="number" min={0} value={leftWallFt} onChange={(e) => setLeftWallFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rightWall" className="text-xs">Right (Length)</Label>
									<Input id="rightWall" type="number" min={0} value={rightWallFt} onChange={(e) => setRightWallFt(e.target.value)} className="h-8" />
								</div>
							</div>
						</div>
						<div className="space-y-2 rounded-lg border border-[rgba(55,50,47,0.12)] p-3 bg-white">
							<Label className="text-xs font-semibold text-[#605A57]">Height and setbacks</Label>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<Label htmlFor="baseHeight" className="text-xs">Base height (ft)</Label>
									<Input id="baseHeight" type="number" min={0} value={baseHeightFt} onChange={(e) => setBaseHeightFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="buildingHeight" className="text-xs">Building height (ft)</Label>
									<Input id="buildingHeight" type="number" min={0} value={buildingHeightFt} onChange={(e) => setBuildingHeightFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="setbackStart" className="text-xs">Setback height (ft)</Label>
									<Input id="setbackStart" type="number" min={0} value={setbackStartFt} onChange={(e) => setSetbackStartFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="frontSetback" className="text-xs">Upper story setback (ft)</Label>
									<Input id="frontSetback" type="number" min={0} value={frontSetbackFt} onChange={(e) => setFrontSetbackFt(e.target.value)} className="h-8" />
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* 3D view */}
				<Card className="lg:col-span-2">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Preview</CardTitle>
					</CardHeader>
					<CardContent>
						{!valid ? (
							<div
								className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-[#F9F8F6] flex items-center justify-center text-sm text-[#605A57]"
								style={{ height: heightPx }}
							>
								Enter valid lot dimensions (length and width).
							</div>
						) : (
							<>
								<div
									className="rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] bg-white"
									style={{ height: heightPx }}
								>
									<Suspense
										fallback={
											<div className="w-full h-full flex items-center justify-center text-sm text-[#605A57]">
												Loading 3D…
											</div>
										}
									>
										<Canvas camera={{ position: [camX, camY, camZ], fov: 50 }} gl={{ antialias: true }}>
											<MassingSandboxScene
												lotLengthFt={lotL}
												lotWidthFt={lotW}
												scale={s}
												groundColor={DEFAULTS.groundColor}
												lotSlabHeightFt={DEFAULTS.lotSlabHeightFt}
												lotSlabPaddingFt={DEFAULTS.lotSlabPaddingFt}
												ambientLightIntensity={DEFAULTS.ambientLightIntensity}
												directionalLightIntensity={DEFAULTS.directionalLightIntensity}
												frontWallFt={frontW}
												backWallFt={backW}
												leftWallFt={leftW}
												rightWallFt={rightW}
												baseHeightFt={baseH}
												buildingHeightFt={buildingH}
												setbackStartFt={setbackStart}
												frontSetbackFt={frontSetback}
												xAlign={xAlign}
												zAlign={zAlign}
											/>
										</Canvas>
									</Suspense>
								</div>
								<div className="mt-2 text-sm text-[#605A57]">
									<Label className="text-xs font-semibold text-[#605A57]">Address</Label>
									<p className="font-medium text-[#37322F]">{address}</p>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
