'use server';

import { getAuthSession } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { userSchema, updateUserSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export async function getUsers(token: string, params?: { page?: number; limit?: number; search?: string }) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner') {
    return { error: 'Only owners can manage users' };
  }

  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    businessId: Number(session.businessId) || 0,
    isDeleted: false,
  };

  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function createUser(
  token: string,
  data: {
    name: string;
    email: string;
    password: string;
    role: 'manager' | 'cashier';
  }
) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner') {
    return { error: 'Only owners can create users' };
  }

  const validatedFields = userSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields', details: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, password, role } = validatedFields.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: 'Email already registered' };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      businessId: Number(session.businessId) || 0,
      createdById: Number(session.id),
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'CREATE_USER',
      entity: 'User',
      entityId: user.id,
      description: `Created user ${user.name} (${user.role})`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/users');

  return {
    success: 'User created',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

export async function updateUser(
  token: string,
  id: number,
  data: { name?: string; email?: string; role?: 'manager' | 'cashier' }
) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner') {
    return { error: 'Only owners can update users' };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    return { error: 'User not found' };
  }

  if (existingUser.role === 'owner') {
    return { error: 'Cannot update owner account' };
  }

  const validatedFields = updateUserSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields', details: validatedFields.error.flatten().fieldErrors };
  }

  const updateData = validatedFields.data;

  if (updateData.email && updateData.email !== existingUser.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: updateData.email },
    });

    if (emailTaken) {
      return { error: 'Email already in use' };
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  await prisma.activityLog.create({
    data: {
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: user.id,
      description: `Updated user ${user.name}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/users');

  return {
    success: 'User updated',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

export async function toggleUserStatus(token: string, id: number) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner') {
    return { error: 'Only owners can manage user status' };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    return { error: 'User not found' };
  }

  if (existingUser.role === 'owner') {
    return { error: 'Cannot deactivate owner account' };
  }

  if (existingUser.id === Number(session.id)) {
    return { error: 'Cannot deactivate your own account' };
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: !existingUser.isActive },
  });

  await prisma.activityLog.create({
    data: {
      action: user.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entity: 'User',
      entityId: user.id,
      description: `${user.isActive ? 'Activated' : 'Deactivated'} user ${user.name}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/users');

  return {
    success: `User ${user.isActive ? 'activated' : 'deactivated'}`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

export async function deleteUser(token: string, id: number) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner') {
    return { error: 'Only owners can delete users' };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    return { error: 'User not found' };
  }

  if (existingUser.role === 'owner') {
    return { error: 'Cannot delete owner account' };
  }

  if (existingUser.id === Number(session.id)) {
    return { error: 'Cannot delete your own account' };
  }

  await prisma.user.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'DELETE_USER',
      entity: 'User',
      entityId: id,
      description: `Deleted user ${existingUser.name}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/users');

  return { success: 'User deleted' };
}
