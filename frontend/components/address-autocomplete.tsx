"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useLoadScript } from "@react-google-maps/api";

import { config } from "@/lib/config";
const GOOGLE_MAPS_API_KEY = config.googleMapsApiKey;

// Move libraries array outside component to prevent reloads
const LIBRARIES: "places"[] = ["places"];

export interface AddressData {
	address: string;
	normalizedAddress: string;
	location: {
		lat: number;
		lng: number;
	};
	placeId: string;
}

interface AddressAutocompleteProps {
	onAddressSelect: (data: AddressData) => void;
	placeholder?: string;
	className?: string;
}

export default function AddressAutocomplete({
	onAddressSelect,
	placeholder = "Add Address",
	className,
}: AddressAutocompleteProps) {
	const [inputValue, setInputValue] = useState("");
	const autocompleteRef = useRef<HTMLInputElement>(null);
	const autocompleteInstanceRef =
		useRef<google.maps.places.Autocomplete | null>(null);
	const inputElementRef = useRef<HTMLInputElement | null>(null);

	const { isLoaded, loadError } = useLoadScript({
		googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
		libraries: LIBRARIES,
	});

	// Debug: Log API key status
	useEffect(() => {
		console.log(
			"API Key loaded:",
			GOOGLE_MAPS_API_KEY
				? "Yes (length: " + GOOGLE_MAPS_API_KEY.length + ")"
				: "No"
		);
		if (!GOOGLE_MAPS_API_KEY) {
			console.error(
				"Google Maps API key is missing. Please create .env.local file with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
			);
		}
		if (loadError) {
			console.error("Google Maps load error:", loadError);
		}
		console.log("isLoaded:", isLoaded, "loadError:", loadError);
	}, [loadError, isLoaded]);

	// Use callback ref to get the actual input element
	const setInputRef = (element: HTMLInputElement | null) => {
		inputElementRef.current = element;
		autocompleteRef.current = element;
	};

	useEffect(() => {
		if (!isLoaded) {
			console.log(
				"Google Maps not loaded yet - waiting for script to load"
			);
			return;
		}

		// Wait a bit for the input to be fully mounted
		const timer = setTimeout(() => {
			const inputElement =
				inputElementRef.current || autocompleteRef.current;

			if (!inputElement) {
				console.log(
					"Input ref not available - input element not mounted yet"
				);
				return;
			}

			// Clean up previous instance if it exists
			if (autocompleteInstanceRef.current) {
				google.maps.event.clearInstanceListeners(
					autocompleteInstanceRef.current
				);
			}

			// Initialize autocomplete
			const autocomplete = new google.maps.places.Autocomplete(
				inputElement,
				{
					types: ["address"],
					componentRestrictions: { country: "us" },
					fields: [
						"formatted_address",
						"address_components",
						"geometry",
						"place_id",
					],
				}
			);

			autocompleteInstanceRef.current = autocomplete;
			console.log("Autocomplete initialized");

			// Handle place selection
			const listener = autocomplete.addListener("place_changed", () => {
				const place = autocomplete.getPlace();

				if (!place.formatted_address || !place.geometry?.location) {
					return;
				}

				// Get normalized address (formatted_address is already normalized)
				const normalizedAddress = place.formatted_address;
				const location = place.geometry.location;

				// Update input value
				setInputValue(normalizedAddress);

				// Call the callback with address data including coordinates
				onAddressSelect({
					address: normalizedAddress,
					normalizedAddress: normalizedAddress,
					location: {
						lat: location.lat(),
						lng: location.lng(),
					},
					placeId: place.place_id || "",
				});
			});

			return () => {
				if (listener) {
					google.maps.event.removeListener(listener);
				}
			};
		}, 100);

		return () => {
			clearTimeout(timer);
		};
	}, [isLoaded, onAddressSelect]);

	if (loadError) {
		return (
			<Input
				ref={setInputRef}
				type="text"
				placeholder="Error loading address autocomplete"
				className={className}
				disabled
			/>
		);
	}

	if (!isLoaded) {
		return (
			<Input
				ref={setInputRef}
				type="text"
				placeholder="Loading..."
				className={className}
				disabled
			/>
		);
	}

	return (
		<Input
			ref={setInputRef}
			type="text"
			placeholder={placeholder}
			value={inputValue || ""}
			onChange={(e) => setInputValue(e.target.value)}
			className={className}
			id="address-autocomplete-input"
			name="address"
			autoComplete="off"
		/>
	);
}
