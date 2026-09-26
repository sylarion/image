'use client';

import React from 'react';
import Link from 'next/link';
import { Project, DashboardMetrics } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';
import { 
  FolderPlus, 
  Image as ImageIcon, 
  CheckCircle, 
  Clock, 
  ArrowUpRight, 
  Layers,
  Camera
} from 'lucide-react';

interface DashboardViewProps {
  initialProjects: Project[];
  metrics: DashboardMetrics;
}

export function DashboardView({ initialProjects, metrics }: DashboardViewProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2230] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Producciones de Moda
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal">
              Fashion Studio
            </span>
          </h1>
          <p className="text-sm text-[#8e96aa] mt-1">
            Automatizá tus sesiones de producto preservando la identidad visual de cada prenda y modelo.
          </p>
        </div>

        <Link
          href="/productions/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-98"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Nueva Producción</span>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#11131a] border border-[#1e2230] hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8e96aa] uppercase tracking-wider">Prendas</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">{metrics.totalGarments}</span>
            <p className="text-xs text-[#8e96aa] mt-0.5">En catálogo activo</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#11131a] border border-[#1e2230] hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8e96aa] uppercase tracking-wider">Generadas</span>
            <ImageIcon className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">{metrics.totalGeneratedImages}</span>
            <p className="text-xs text-[#8e96aa] mt-0.5">Fotografías producidas</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#11131a] border border-[#1e2230] hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8e96aa] uppercase tracking-wider">Aprobadas</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">{metrics.approvedImages}</span>
            <p className="text-xs text-[#8e96aa] mt-0.5">&gt;90% Garment Lock</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#11131a] border border-[#1e2230] hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8e96aa] uppercase tracking-wider">Pendientes</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">{metrics.pendingJobs}</span>
            <p className="text-xs text-[#8e96aa] mt-0.5">Trabajos en cola</p>
          </div>
        </div>
      </div>

      {/* Recent Productions List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white tracking-tight">Producciones Recientes</h2>
          <span className="text-xs text-[#8e96aa]">{initialProjects.length} producciones registradas</span>
        </div>

        {initialProjects.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[#1e2230] bg-[#11131a]/50">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No tenés producciones todavía</h3>
            <p className="text-sm text-[#8e96aa] max-w-sm mx-auto mt-1 mb-6">
              Empezá cargando fotografías reales de tu primera prenda para crear el Garment Lock y generar tu catálogo.
            </p>
            <Link
              href="/productions/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Crear primera producción</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {initialProjects.map((project) => {
              const thumbnail =
                project.garment.referenceImages[0]?.url ||
                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80';
              const completedCount = project.jobs.filter((j) => j.status === 'APPROVED').length;

              return (
                <Link
                  key={project.id}
                  href={`/productions/${project.id}`}
                  className="group block rounded-2xl bg-[#11131a] border border-[#1e2230] hover:border-blue-500/50 transition-all duration-200 overflow-hidden hover:shadow-xl hover:shadow-blue-500/5 flex flex-col"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnail}
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#11131a] via-transparent to-transparent opacity-80" />

                    <div className="absolute top-3 left-3">
                      <StatusBadge status={project.status} />
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                      <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 font-mono text-[11px]">
                        {project.garment.category}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[11px]">
                        {project.jobs.length > 0 ? `${completedCount}/${project.jobs.length} fotos` : 'Sin fotos'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate text-sm">
                          {project.name}
                        </h3>
                        <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>

                      <div className="mt-1.5 text-xs text-[#8e96aa] flex items-center justify-between">
                        <span>{project.garment.sizes.join(', ')}</span>
                        <span>{formatDate(project.createdAt)}</span>
                      </div>
                    </div>

                    {project.garment.mustPreserve.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#1e2230] flex items-center gap-1.5 overflow-hidden">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1d28] text-gray-300 font-mono truncate">
                          ✓ {project.garment.mustPreserve[0]}
                        </span>
                        {project.garment.mustPreserve.length > 1 && (
                          <span className="text-[10px] text-gray-500 font-mono shrink-0">
                            +{project.garment.mustPreserve.length - 1} reglas
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
