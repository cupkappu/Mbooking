'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useSetup } from '@/hooks/use-setup';

const setupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
    .regex(/\d/, 'Password must contain at least 1 number')
    .regex(/[!@#$%^&*]/, 'Password must contain at least 1 special character (!@#$%^&*)'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  organizationName: z.string().optional(),
});

type SetupFormData = z.infer<typeof setupSchema>;

export function SetupForm() {
  const { isInitializing, initializeError, initialize } = useSetup();
  const [initSecret, setInitSecret] = useState('');
  const [secretError, setSecretError] = useState<string | null>(null);

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      organizationName: '',
    },
    mode: 'onChange',
  });

  const { register, handleSubmit, formState: { errors, isValid } } = form;

  // Load INIT_SECRET from localStorage
  useEffect(() => {
    const secret = localStorage.getItem('initSecret');
    if (secret) {
      setInitSecret(secret);
    }
  }, []);

  const onSubmit = async (data: SetupFormData) => {
    if (!initSecret) {
      setSecretError('Please enter the initialization secret');
      return;
    }

    await initialize({ data, initSecret });
    localStorage.setItem('initSecret', initSecret);
  };

  const passwordValue = form.watch('password');
  const hasUpperCase = /[A-Z]/.test(passwordValue || '');
  const hasLowerCase = /[a-z]/.test(passwordValue || '');
  const hasNumber = /\d/.test(passwordValue || '');
  const hasSpecial = /[!@#$%^&*]/.test(passwordValue || '');
  const hasMinLength = (passwordValue || '').length >= 12;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>System Setup</CardTitle>
        <CardDescription>
          Create your administrator account to initialize the system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Initialization Secret */}
          <div className="space-y-2">
            <Label htmlFor="initSecret">Initialization Secret</Label>
            <Input
              id="initSecret"
              type="password"
              value={initSecret}
              onChange={(e) => {
                setInitSecret(e.target.value);
                setSecretError(null);
              }}
              placeholder="Enter INIT_SECRET from environment"
              disabled={isInitializing}
            />
            {secretError && (
              <p className="text-sm text-red-500">{secretError}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="admin@example.com"
              disabled={isInitializing}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              {...register('name')}
              placeholder="Administrator"
              disabled={isInitializing}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              placeholder="Enter a strong password"
              disabled={isInitializing}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}

            {/* Password strength indicators */}
            {passwordValue && (
              <div className="space-y-1 text-sm">
                <p className={hasMinLength ? 'text-green-500' : 'text-gray-500'}>
                  {hasMinLength ? '✓' : '○'} At least 12 characters
                </p>
                <p className={hasUpperCase ? 'text-green-500' : 'text-gray-500'}>
                  {hasUpperCase ? '✓' : '○'} 1 uppercase letter
                </p>
                <p className={hasLowerCase ? 'text-green-500' : 'text-gray-500'}>
                  {hasLowerCase ? '✓' : '○'} 1 lowercase letter
                </p>
                <p className={hasNumber ? 'text-green-500' : 'text-gray-500'}>
                  {hasNumber ? '✓' : '○'} 1 number
                </p>
                <p className={hasSpecial ? 'text-green-500' : 'text-gray-500'}>
                  {hasSpecial ? '✓' : '○'} 1 special character (!@#$%^&*)
                </p>
              </div>
            )}
          </div>

          {/* Organization Name (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization Name (Optional)</Label>
            <Input
              id="organizationName"
              type="text"
              {...register('organizationName')}
              placeholder="My Company"
              disabled={isInitializing}
            />
          </div>

          {/* Error Message */}
          {initializeError && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
              {initializeError}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isInitializing || !isValid || !initSecret}
          >
            {isInitializing ? 'Initializing...' : 'Initialize System'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
