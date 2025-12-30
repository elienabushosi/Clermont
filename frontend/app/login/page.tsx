"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Allowed credentials (case-insensitive)
const ALLOWED_CREDENTIALS = [
	{ firstName: "Elie", lastName: "Nabushosi" },
	{ firstName: "Chris", lastName: "Mancia" },
];

export default function LoginPage() {
	const router = useRouter();
	const [isSuccess, setIsSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			firstName: "",
			lastName: "",
		},
	});

	const onSubmit = (data: LoginFormValues) => {
		setError(null);
		
		// Check credentials (case-insensitive)
		const isValid = ALLOWED_CREDENTIALS.some(
			(cred) =>
				cred.firstName.toLowerCase() === data.firstName.toLowerCase() &&
				cred.lastName.toLowerCase() === data.lastName.toLowerCase()
		);

		if (isValid) {
			// Wait 1 second, then turn button green
			setTimeout(() => {
				setIsSuccess(true);
				// Navigate to home page after showing success
				setTimeout(() => {
					router.push("/home");
				}, 500);
			}, 1000);
		} else {
			setError("Invalid credentials. Please check your first and last name.");
		}
	};

	return (
		<div className="w-full min-h-screen bg-[#F7F5F3] flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<div className="bg-white rounded-lg shadow-sm border border-[rgba(55,50,47,0.12)] p-8">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Log in to Lindero
					</h1>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="space-y-6"
						>
							<FormField
								control={form.control}
								name="firstName"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											First Name
										</FormLabel>
										<FormControl>
											<Input
												type="text"
												placeholder="Enter your first name"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="lastName"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											Last Name
										</FormLabel>
										<FormControl>
											<Input
												type="text"
												placeholder="Enter your last name"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{error && (
								<div className="text-sm text-red-600">
									{error}
								</div>
							)}
							<Button
								type="submit"
								className={`w-full text-white ${
									isSuccess
										? "bg-green-600 hover:bg-green-700"
										: "bg-[#37322F] hover:bg-[#37322F]/90"
								}`}
							>
								{isSuccess ? "Access granted" : "Log in"}
							</Button>
						</form>
					</Form>
				</div>
			</div>
		</div>
	);
}

