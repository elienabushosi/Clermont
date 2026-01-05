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

const signupSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	firstName: z.string().min(1, "First name is required"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	organizationName: z.string().min(1, "Organization name is required"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const form = useForm<SignupFormValues>({
		resolver: zodResolver(signupSchema),
		defaultValues: {
			email: "",
			firstName: "",
			password: "",
			organizationName: "",
		},
	});

	const onSubmit = async (data: SignupFormValues) => {
		setError(null);
		setIsLoading(true);

		try {
			const response = await fetch(
				"http://localhost:3002/api/auth/signup",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(data),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				setError(result.message || "Failed to create account");
				setIsLoading(false);
				return;
			}

			// Success
			setSuccess(true);
			// Redirect to login page after a short delay
			setTimeout(() => {
				router.push("/login");
			}, 2000);
		} catch (error) {
			console.error("Signup error:", error);
			setError("An error occurred. Please try again.");
			setIsLoading(false);
		}
	};

	return (
		<div className="w-full min-h-screen bg-[#F7F5F3] flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<div className="bg-white rounded-lg shadow-sm border border-[rgba(55,50,47,0.12)] p-8">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Create an account
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
							{error && (
								<div className="text-sm text-red-600">
									{error}
								</div>
							)}
							{success && (
								<div className="text-sm text-green-600">
									Account created successfully! Redirecting to
									login...
								</div>
							)}
							<Button
								type="submit"
								disabled={isLoading || success}
								className={`w-full text-white ${
									success
										? "bg-green-600 hover:bg-green-700"
										: "bg-[#37322F] hover:bg-[#37322F]/90"
								}`}
							>
								{isLoading
									? "Creating account..."
									: success
									? "Account created!"
									: "Create account"}
							</Button>
						</form>
					</Form>
				</div>
			</div>
		</div>
	);
}
