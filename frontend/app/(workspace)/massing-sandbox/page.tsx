"use client";

import { useState, Suspense, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import React from "react";
import * as THREE from "three";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Default values matching typical report data */
const DEFAULTS = {
	address: "281 Clermont Ave, Brooklyn, NY 11205",
	// Lot: Front 25, Back 25, Left 100, Right 100 → width 25, length 100
	lotLengthFt: 100,
	lotWidthFt: 25,
	scale: 0.1,
	groundColor: "#E5E7EB",
	containerHeightPx: 400,
	lotSlabHeightFt: 10,
	lotSlabPaddingFt: 2,
	ambientLightIntensity: 0.6,
	directionalLightIntensity: 0.8,
	// Initial camera ~180° from front, zoomed out a bit
	cameraPosX: -6.5,
	cameraPosY: 6.5,
	cameraPosZ: -22,
	// Building (block) defaults: Front 20, Back 20, Left 80, Right 80; height 10 ft
	frontWallFt: 20,
	backWallFt: 20,
	leftWallFt: 80,
	rightWallFt: 80,
	buildingHeightFt: 10,
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
			<line ref={lineRef}>
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

/** 3D scene driven by sandbox state */
function MassingSandboxScene({
	lotLengthFt,
	lotWidthFt,
	scale,
	groundColor,
	lotSlabHeightFt = 10,
	lotSlabPaddingFt = 2,
	ambientLightIntensity = 0.6,
	directionalLightIntensity = 0.8,
	frontWallFt = 20,
	backWallFt = 20,
	leftWallFt = 80,
	rightWallFt = 80,
	buildingHeightFt = 10,
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
	buildingHeightFt?: number;
}) {
	const lotLength = lotLengthFt * scale;
	const lotWidth = lotWidthFt * scale;
	const centerX = 0;
	const centerZ = 0;
	const slabPadding = (lotSlabPaddingFt ?? 0) * scale;
	const slabLength = lotLength + slabPadding * 2;
	const slabWidth = lotWidth + slabPadding * 2;
	const slabHeight = (lotSlabHeightFt ?? 10) * scale;

	// Building footprint: independent edges; vertices then offset so footprint is centered on the lot.
	const anchorX = centerX - lotWidth / 2;
	const anchorZ = centerZ - lotLength / 2;
	const front = frontWallFt * scale;
	const back = backWallFt * scale;
	const left = leftWallFt * scale;
	const right = rightWallFt * scale;
	const buildingHeight = (buildingHeightFt ?? 10) * scale;

	// Centroid of quad (frontLeft, frontRight, backRight, backLeft) so we can center the shape
	const footprintCenterX = anchorX + (front + back) / 4;
	const footprintCenterZ = anchorZ + (left + right) / 4;
	const offsetX = centerX - footprintCenterX;
	const offsetZ = centerZ - footprintCenterZ;

	const footprintShape = useMemo(() => {
		const s = new THREE.Shape();
		// Shape is in XY; we use (world X, -world Z) so after rotation -π/2 around X (local Z→world Y) we get world Z correct
		// Vertices offset so footprint is centered on (centerX, centerZ)
		// Counterclockwise: frontLeft -> frontRight -> backRight -> backLeft
		s.moveTo(anchorX + offsetX, -(anchorZ + offsetZ));
		s.lineTo(anchorX + front + offsetX, -(anchorZ + offsetZ));
		s.lineTo(anchorX + back + offsetX, -(anchorZ + right + offsetZ));
		s.lineTo(anchorX + offsetX, -(anchorZ + left + offsetZ));
		s.lineTo(anchorX + offsetX, -(anchorZ + offsetZ));
		return s;
	}, [anchorX, anchorZ, front, back, left, right, offsetX, offsetZ]);

	const buildingGeometry = useMemo(() => {
		return new THREE.ExtrudeGeometry(footprintShape, {
			depth: buildingHeight,
			bevelEnabled: false,
		});
	}, [footprintShape, buildingHeight]);

	useEffect(() => {
		return () => buildingGeometry.dispose();
	}, [buildingGeometry]);

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

			{/* White building: extruded footprint (each wall moves independently); extrusion was along +Z, rotate so it goes +Y */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
				<primitive object={buildingGeometry} attach="geometry" />
				<meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.4} />
			</mesh>

			{/* Building side labels (smaller than lot dimension labels) */}
			<CameraAwareLabel position={[anchorX + offsetX + front / 2, buildingHeight / 2 + 0.05, anchorZ + offsetZ]} center>
				<div className="bg-white/92 backdrop-blur-sm rounded px-1 py-0.5 text-[8px] font-medium text-[#37322F] border border-[rgba(55,50,47,0.12)] shadow-sm whitespace-nowrap">
					Front
				</div>
			</CameraAwareLabel>
			<CameraAwareLabel position={[anchorX + offsetX + back / 2, buildingHeight / 2 + 0.05, anchorZ + offsetZ + (left + right) / 2]} center>
				<div className="bg-white/92 backdrop-blur-sm rounded px-1 py-0.5 text-[8px] font-medium text-[#37322F] border border-[rgba(55,50,47,0.12)] shadow-sm whitespace-nowrap">
					Back
				</div>
			</CameraAwareLabel>
			<CameraAwareLabel position={[anchorX + offsetX, buildingHeight / 2 + 0.05, anchorZ + offsetZ + left / 2]} center>
				<div className="bg-white/92 backdrop-blur-sm rounded px-1 py-0.5 text-[8px] font-medium text-[#37322F] border border-[rgba(55,50,47,0.12)] shadow-sm whitespace-nowrap">
					Right
				</div>
			</CameraAwareLabel>
			<CameraAwareLabel position={[anchorX + offsetX + (front + back) / 2, buildingHeight / 2 + 0.05, anchorZ + offsetZ + right / 2]} center>
				<div className="bg-white/92 backdrop-blur-sm rounded px-1 py-0.5 text-[8px] font-medium text-[#37322F] border border-[rgba(55,50,47,0.12)] shadow-sm whitespace-nowrap">
					Left
				</div>
			</CameraAwareLabel>

			{/* Lot length dimension line - front to back along Z, positioned on left edge */}
			<DimensionLineWithLabel
				start={[centerX - lotWidth / 2, 0.1, centerZ - lotLength / 2]}
				end={[centerX - lotWidth / 2, 0.1, centerZ + lotLength / 2]}
				label={`${lotLengthFt} ft`}
				color="#37322F"
				lineWidth={2}
				labelOffset={0.2}
			/>
			{/* Lot width dimension line - left to right along X, positioned on front edge */}
			<DimensionLineWithLabel
				start={[centerX - lotWidth / 2, 0.1, centerZ - lotLength / 2]}
				end={[centerX + lotWidth / 2, 0.1, centerZ - lotLength / 2]}
				label={`${lotWidthFt} ft`}
				color="#37322F"
				lineWidth={2}
				labelOffset={0.2}
			/>

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
	const [buildingHeightFt, setBuildingHeightFt] = useState(String(DEFAULTS.buildingHeightFt));

	const lotL = parseNum(lotLengthFt, DEFAULTS.lotLengthFt);
	const lotW = parseNum(lotWidthFt, DEFAULTS.lotWidthFt);
	const s = DEFAULTS.scale;
	const heightPx = DEFAULTS.containerHeightPx;
	const valid = lotL > 0 && lotW > 0 && s > 0;
	const frontW = parseNum(frontWallFt, DEFAULTS.frontWallFt);
	const backW = parseNum(backWallFt, DEFAULTS.backWallFt);
	const leftW = parseNum(leftWallFt, DEFAULTS.leftWallFt);
	const rightW = parseNum(rightWallFt, DEFAULTS.rightWallFt);
	const buildingH = parseNum(buildingHeightFt, DEFAULTS.buildingHeightFt);

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
						<div className="space-y-2 rounded-lg border border-[rgba(55,50,47,0.12)] p-3 bg-[#F9F8F6]">
							<Label className="text-xs font-semibold text-[#605A57]">Building walls (ft) — each edge moves independently</Label>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<Label htmlFor="frontWall" className="text-xs">Front</Label>
									<Input id="frontWall" type="number" min={0} value={frontWallFt} onChange={(e) => setFrontWallFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="backWall" className="text-xs">Back</Label>
									<Input id="backWall" type="number" min={0} value={backWallFt} onChange={(e) => setBackWallFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="leftWall" className="text-xs">Left</Label>
									<Input id="leftWall" type="number" min={0} value={leftWallFt} onChange={(e) => setLeftWallFt(e.target.value)} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rightWall" className="text-xs">Right</Label>
									<Input id="rightWall" type="number" min={0} value={rightWallFt} onChange={(e) => setRightWallFt(e.target.value)} className="h-8" />
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
									className="rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] bg-[#F9F8F6]"
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
											buildingHeightFt={buildingH}
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
