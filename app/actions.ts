'use server'

import { prisma } from './lib/prisma'
import { revalidatePath } from 'next/cache'

// --- Equipment Actions ---

export async function getEquipment() {
  return await prisma.equipment.findMany({
    orderBy: { id: 'asc' }
  })
}

export async function addEquipment(name: string, total: number) {
  await prisma.equipment.create({
    data: {
      name,
      total,
      available: total
    }
  })
  revalidatePath('/borrow')
}

export async function deleteEquipment(id: number) {
  // Check if there are active borrows? For simplicity, we just delete or maybe restrictive.
  // Ideally, should check constraint. But prisma relation handles cascade or error.
  // We'll just delete them.
  try {
    await prisma.equipment.delete({ where: { id } })
    revalidatePath('/borrow')
  } catch (error) {
    console.error("Delete failed", error)
  }
}

export async function updateStock(id: number, delta: number) {
  const eq = await prisma.equipment.findUnique({ where: { id } })
  if (!eq) return

  const newTotal = eq.total + delta
  const newAvailable = eq.available + delta

  if (newTotal < 0 || newAvailable < 0) return // Prevent negative default

  await prisma.equipment.update({
    where: { id },
    data: {
      total: newTotal,
      available: newAvailable
    }
  })
  revalidatePath('/borrow')
}

// --- Borrow/Return Actions ---

export async function getRecords() {
  return await prisma.borrowRecord.findMany({
    orderBy: { borrowDate: 'desc' },
    include: { equipment: true } // Join table
  })
}

export async function borrowItem(userName: string, equipmentId: number) {
  const eq = await prisma.equipment.findUnique({ where: { id: equipmentId } })
  if (!eq || eq.available <= 0) {
    throw new Error("Out of stock")
  }

  // Transaction to ensure atomicity
  await prisma.$transaction([
    prisma.equipment.update({
      where: { id: equipmentId },
      data: { available: { decrement: 1 } }
    }),
    prisma.borrowRecord.create({
      data: {
        userName,
        equipmentId,
        status: 'ACTIVE'
      }
    })
  ])
  
  revalidatePath('/borrow')
}

export async function returnItem(recordId: number) {
  const record = await prisma.borrowRecord.findUnique({ where: { id: recordId } })
  if (!record || record.status === 'RETURNED') return

  await prisma.$transaction([
    prisma.borrowRecord.update({
      where: { id: recordId },
      data: { 
        status: 'RETURNED',
        returnDate: new Date()
      }
    }),
    prisma.equipment.update({
      where: { id: record.equipmentId },
      data: { available: { increment: 1 } }
    })
  ])
  
  revalidatePath('/borrow')
}

export async function clearHistory() {
  await prisma.borrowRecord.deleteMany({})
  revalidatePath('/borrow')
}
