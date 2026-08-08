'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { loginSchema, registerSchema, changePasswordSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

export async function login(data: { email: string; password: string }) {
  const validatedFields = loginSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields' };
  }

  const { email, password } = validatedFields.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive || user.isDeleted) {
    return { error: 'Invalid credentials' };
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return { error: 'Invalid credentials' };
  }

  await prisma.activityLog.create({
    data: {
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      description: `User ${user.name} logged in`,
      userId: user.id,
      businessId: user.businessId || 0,
    },
  });

  return {
    success: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    },
  };
}

export async function register(data: { name: string; email: string; password: string }) {
  const validatedFields = registerSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields' };
  }

  const { name, email, password } = validatedFields.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: 'Email already registered' };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'owner',
      },
    });

    const business = await tx.business.create({
      data: {
        name: `${name}'s Business`,
        ownerId: user.id,
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { businessId: business.id },
    });

    return updatedUser;
  });

  await prisma.activityLog.create({
    data: {
      action: 'REGISTER_USER',
      entity: 'User',
      entityId: result.id,
      description: `Registered user ${name} as owner`,
      userId: result.id,
      businessId: result.businessId || 0,
    },
  });

  return {
    success: 'Registration successful',
    user: {
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
      businessId: result.businessId,
    },
  };
}

export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      businessId: true,
      createdAt: true,
    },
  });

  return user;
}

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const validatedFields = changePasswordSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields' };
  }

  const { currentPassword, newPassword } = validatedFields.data;

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.password);

  if (!passwordMatch) {
    return { error: 'Current password is incorrect' };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  await prisma.activityLog.create({
    data: {
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: user.id,
      description: `User ${user.name} changed password`,
      userId: user.id,
      businessId: user.businessId || 0,
    },
  });

  return { success: 'Password changed successfully' };
}

export async function updateProfile(data: { name: string; email: string }) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  if (data.email !== user.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      return { error: 'Email already in use' };
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      email: data.email,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'UPDATE_PROFILE',
      entity: 'User',
      entityId: user.id,
      description: `User ${user.name} updated profile`,
      userId: user.id,
      businessId: user.businessId || 0,
    },
  });

  revalidatePath('/dashboard/settings');

  return {
    success: 'Profile updated successfully',
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      businessId: updatedUser.businessId,
    },
  };
}