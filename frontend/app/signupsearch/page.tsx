"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft } from "lucide-react";
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

const signupSearchSchema = z.object({
	firstName: z.string().min(1, "Name is required"),
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	organizationName: z.string().min(1, "Organization name is required"),
});

type SignupSearchFormValues = z.infer<typeof signupSearchSchema>;

export default function SignupSearchPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<SignupSearchFormValues>({
		resolver: zodResolver(signupSearchSchema),
		defaultValues: {
			firstName: "",
			email: "",
			password: "",
			organizationName: "",
		},
	});

	const onSubmit = async (data: SignupSearchFormValues) => {
		setError(null);
		setIsLoading(true);

		try {
			const payload = {
				email: data.email.toLowerCase().trim(),
				firstName: data.firstName.trim(),
				password: data.password,
				organizationType: "new" as const,
				organizationName: data.organizationName.trim(),
			};

			const signupRes = await fetch(`${config.apiUrl}/api/auth/signup`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const signupResult = await signupRes.json();

			if (!signupRes.ok) {
				setError(signupResult.message || "Failed to create account");
				setIsLoading(false);
				return;
			}

			// Signup succeeded — log in with same credentials
			const loginRes = await fetch(`${config.apiUrl}/api/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: payload.email,
					password: payload.password,
				}),
			});

			const loginResult = await loginRes.json();

			if (!loginRes.ok) {
				setIsLoading(false);
				router.push("/login");
				return;
			}

			if (loginResult.token) {
				localStorage.setItem("auth_token", loginResult.token);
			}

			router.push("/search-address");
		} catch (err) {
			console.error("Signup/search error:", err);
			setError("An error occurred. Please try again.");
			setIsLoading(false);
		}
	};

	return (
		<div className="w-full min-h-screen bg-[#F7F5F3] flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<button
					type="button"
					onClick={() => router.push("/report-options")}
					className="mb-4 flex items-center gap-2 text-[#37322F] hover:text-[#4090C2] transition-colors text-sm font-medium"
				>
					<ArrowLeft className="w-4 h-4" />
					Back
				</button>
				<div className="bg-white rounded-lg shadow-sm border border-[rgba(55,50,47,0.12)] p-8">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6 text-center">
						Where should we send your report?
					</h1>
					{error && (
						<p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded-md">
							{error}
						</p>
					)}
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
											Name
										</FormLabel>
										<FormControl>
											<Input
												type="text"
												placeholder="Enter your name"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											Email
										</FormLabel>
										<FormControl>
											<Input
												type="email"
												placeholder="Enter your email"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											Password
										</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="Enter your password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="organizationName"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											Organization Name
										</FormLabel>
										<FormControl>
											<Input
												type="text"
												placeholder="Enter your organization name"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button
								type="submit"
								disabled={isLoading}
								className="w-full h-11 bg-[#D09376] hover:bg-[#D09376]/90 text-white font-medium"
							>
								{isLoading ? (
									<>
										<span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
										Creating account...
									</>
								) : (
									"Continue"
								)}
							</Button>
						</form>
					</Form>
				</div>
			</div>
		</div>
	);
}
