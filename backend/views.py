from django.shortcuts import render, HttpResponse

def home(request):
    return HttpResponse("hello world")

# Create your views here.
