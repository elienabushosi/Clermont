"use client";

import { useEffect } from "react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { AddressData } from "./address-autocomplete";

interface AddressMapProps {
	addressData: AddressData | null;
}

import { config } from "@/lib/config";
const GOOGLE_MAPS_API_KEY = config.googleMapsApiKey;

// Move libraries array outside component to prevent reloads
const LIBRARIES: "places"[] = ["places"];

const mapContainerStyle = {
	width: "100%",
	height: "400px",
};

const defaultCenter = {
	lat: 40.7128,
	lng: -74.006,
};

export default function AddressMap({ addressData }: AddressMapProps) {
	const { isLoaded, loadError } = useLoadScript({
		googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
		libraries: LIBRARIES,
	});

	// Debug: Log API key status
	useEffect(() => {
		if (!GOOGLE_MAPS_API_KEY) {
			console.error(
				"Google Maps API key is missing in AddressMap. Please create .env.local file with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
			);
		}
		if (loadError) {
			console.error("Google Maps load error in AddressMap:", loadError);
		}
	}, [loadError]);

	if (loadError) {
		return (
			<div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center border border-[rgba(55,50,47,0.12)]">
				<p className="text-[#605A57]">Error loading map</p>
			</div>
		);
	}

	if (!isLoaded) {
		return (
			<div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center border border-[rgba(55,50,47,0.12)]">
				<p className="text-[#605A57]">Loading map...</p>
			</div>
		);
	}

	if (!addressData) {
		return null;
	}

	return (
		<div className="w-full rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] shadow-sm">
			<GoogleMap
				mapContainerStyle={mapContainerStyle}
				center={{
					lat: addressData.location.lat,
					lng: addressData.location.lng,
				}}
				zoom={15}
				options={{
					streetViewControl: false,
					mapTypeControl: false,
					fullscreenControl: true,
				}}
			>
				<Marker
					position={{
						lat: addressData.location.lat,
						lng: addressData.location.lng,
					}}
				/>
			</GoogleMap>
		</div>
	);
}
